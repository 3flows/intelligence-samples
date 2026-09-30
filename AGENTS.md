# Building AI features with 3flows Intelligence – rules for agents

> **Status: draft.** This file tells a coding agent how to build AI features with `@3flows/intelligence`,
> on top of `@3flows/platform`. Read it completely before writing code. The platform's own rules
> ([platform-samples/AGENTS.md](https://github.com/3flows/platform-samples/blob/main/AGENTS.md)) apply as well.

## Why these rules exist

You write the code. A human reviews it and takes responsibility for it in production. For AI features that's harder
than usual: part of the behavior is in prompts, the model sees context assembled at runtime, it may call tools, and it
doesn't answer the same way twice. **Code that uses the fluent API's small vocabulary answers the reviewer's questions
in one read:** what does the model get, what may it do, what happens with the answer, which vendor sees the data.

## 1. Pick the capability

| You need… | Use | Not |
|---|---|---|
| Text in, text out | `trigger.context.inference().chat()…ask(q)` in an `IntelligenceService` | A vendor SDK |
| One option of a fixed set | `.choice(name).oneOf(options)` | Parsing `chat()` text |
| Several options of a fixed set | `.choice(name).manyOf(options)` | Comma-separated text |
| Yes or no | `.check(name)` | `answer.includes('yes')` |
| A number on a scale | `.score(name).between(min, max).criteria(...)` | `parseInt(answer)` |
| A record with fields | `.extract(name).schema(zod)` | "Answer in JSON" prompts |
| A chat that remembers | `trigger.context.conversations().conversation(id)` | Arrays of messages on the service |
| The model looks something up | `.tools(...)` / `.service(name, method)` | Pre-loading every record into the prompt |
| Search by meaning | `.embedding()` + the platform's `vectors` | Keyword search, own vector math |
| Better ordering of search hits | `.reranker()` | Asking a chat model to sort |
| Audio to text / text to audio | `.transcriber()` / `.speech()` | Vendor SDKs |
| Safety screening | `.moderation().check(text)` | A chat prompt asking "is this safe?" |
| Policy, tone, rules | `prompts` in YAML + `.prompt(name, vars)` | String constants in code |

If nothing fits, stop and ask the human.

## 2. Hard rules

1. **Import only from `@3flows/intelligence` and `@3flows/platform`.** No vendor SDKs (`openai`, `@anthropic-ai/sdk`, …) in application code.
2. **Code asks for a capability; YAML decides the model.** Providers, models, keys and defaults live in `ais`. Use `.model(name)` only to name a *job* (`'triage'`), never a vendor.
3. **Customer text goes into `.with(...)`, never into `instructions` or prompt templates.**
4. **Policy goes into `prompts` in YAML**, with a `version`. Bump it on every change.
5. **Prefer decisions over text.** If code branches on the answer, it's a `choice`, `check`, `score` or `extract` – never parsed text.
6. **Options are described** (`oneOf({ billing: 'Payments, invoices…' })`), scores have `criteria`, extraction fields that may be missing are `.nullable()` and `.describe()`d.
7. **Store `reason`** with every decision a human might question later.
8. **The model decides what the text means; code decides what happens.** Thresholds, priorities and actions are ordinary, tested code.
9. **Tools are permissions.** List them explicitly per call. The model fills in every tool argument: never let it choose *whose* data it sees – close over the caller's identity (see step 12). No irreversible actions as tools without a human confirmation.
10. **Model calls are slow remote calls.** Keep them off request paths where a person waits for something else (use `mq`), set `retry`/`timeoutMs` in `defaults`, and give every feature a defined behavior without an answer.
11. **Conversation ids come from the domain** (`ticket-<id>`) and are checked against the caller.
12. **Tag calls with `.metadata({...})`** (ticket, job), so runs are traceable and costs attributable.
13. **Tests never call a real model.** Use the scripted provider and `runOffline(yaml)`. Real-model runs are evaluations, kept out of `yarn test`.
14. **Services that use AI extend `IntelligenceService`** and reach it through `trigger.context` (`inference()`, `conversations()`, `prompts()`). Use the static `Intelligence.*` only outside services: scripts, evaluations, tests.
15. **A change to prompts, option descriptions, judges or models comes with an evaluation run**, and the reviewer's view names the numbers before and after, and the cases that got worse.

## 3. The shapes to copy

**A decision, in a service**

```ts
const department = await trigger.context.inference()
    .choice('department')
    .model('triage')
    .metadata({ ticketId: ticket.id, job: 'triage' })
    .oneOf(departments)                        // Record<Department, description>
    .with({ subject: ticket.subject, body: ticket.body })
    .ask('Which team should handle this ticket?');

await tickets.by(ticket.id).set({ ...ticket, department: department.value, departmentReason: department.reason ?? null });
```

**A conversation with a scoped tool and retrieval**

```ts
const articles = await trigger.context.service('HelpCenterService').method('searchArticles').input({ query: message, limit: 4 }).call<Passage[]>();
const answer = await trigger.context.conversations()
    .conversation(`ticket-${ticket.id}`)
    .prompt('support.chat', { shop: 'Velo' })
    .with({ subject: ticket.subject, body: ticket.body })
    .with({ articles })
    .tools(ordersOf(ticket, trigger.context))   // closes over ticket.email
    .ask(message);
```

**The YAML**

```yaml
ais:
  - name: DEFAULT                 # chat and replies
    provider: openai
    model: gpt-4.1
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }
    defaults: { temperature: 0.3, retry: { attempts: 3, backoffMs: 1000 } }
  - name: triage                  # decisions
    provider: openai
    model: gpt-4.1-nano
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }
    defaults: { temperature: 0 }
  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }

prompts:
  - name: support.chat
    version: v3
    template: |
      …

conversations:
  store:
    type: entities

entities:
  backend: docs
  ontologies:
    - IntelligenceConversationsOntology
```

**A test**

```ts
before(() => runOffline('./steps/NN-name/intelligence.yml'));
after(() => Platform.shutdown());
beforeEach(() => ScriptedAI.reset((request) => request.responseSchemaName === 'department'
    ? { value: 'billing', confidence: 0.9, reason: 'Duplicate charge.' }
    : 'OK'));
// then assert on ScriptedAI.requests: instructions, inputs, tools, ai
```

## 4. Definition of done

- `yarn test` passes, offline.
- Tests assert what the model gets (prompt, inputs, tools), and how the code handles unexpected answers and failures.
- Finish with a **reviewer's view**, three to five lines: what the feature does, which capabilities and AIs it uses,
  what data leaves the system to which provider, what the model may do on its own, and the one question the reviewer
  should really think about (an option list, a threshold, a tool's scope, retention).

## 5. Known gaps

See https://3flows.github.io/intelligence-docs/docs/guides/known-gaps. In short: binary files (images, PDFs) aren't
accepted in chat yet, `ocr` and `video` have no bundled provider, `stream()` doesn't run tools, and conversations send
their whole history. Platform handlers validate input but don't apply Zod defaults: use destructuring defaults.

## 6. Where to look

1. This file, then the platform's AGENTS.md.
2. The steps in `support-desk/steps/`: find the closest one and copy its patterns. Part 5 (steps 16–21) for evaluations and guardrails.
3. The docs: https://3flows.github.io/intelligence-docs/ – especially *Core concepts* and the *Fluent API* reference.
4. The public types of `@3flows/intelligence`.
