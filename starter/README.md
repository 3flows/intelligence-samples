# Starter

A small 3flows Intelligence 0.9 app. It shows the current building blocks in one place:

- `IntelligenceService`, `handler`, and `tool` imported from `@3flows/intelligence`
- Fluent inference through `trigger.context.inference()`
- service-level tool discovery with `tool(...)`
- a configured `chatbots:` entry with HTTP conversation compatibility
- a configured `skills:` entry
- a configured `agents:` entry
- a code-defined workflow registered at runtime

## Run

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
export OPENAI_API_KEY=<your key>   # only needed when a handler/chatbot/agent calls the model
yarn install
yarn start
```

Health check:

```sh
curl localhost:3000/health
```

## Try the service handlers

The platform exposes registered service handlers on the configured HTTP server. Exact route projection depends on your Platform version, but the `SupportService` handlers are:

- `ask` — direct Fluent chat call
- `askWithWorkflow` — runs the `starter.quickAnswer` workflow
- `runAgent` — starts `starter_agent`
- `lookupOrder` — model-facing read-only tool metadata, usable by chatbots/agents/Fluent `toolsFrom(...)`

## Chatbot and agent routes

`intelligence.yml` exposes:

```text
/support                         # chatbot HTTP compatibility root
/agents/starter                  # native agent run routes
```

The chatbot uses `support.chatbot.base`, keeps a bounded history, and can discover public tools from `SupportService`.

The agent uses the `starter_support` skill, the same service tools, basic policy, and a memory workspace backed by Platform docs/blobs.

## Workflow

`workflows.ts` defines `starter.quickAnswer`:

```ts
workflow('starter.quickAnswer')
  .input<{ question: string }>()
  .step('answer', (s) => s.inference().chat().question(({ input }) => input.question).define())
  .returns(({ steps }) => ({ answer: steps.answer.text ?? '' }));
```

`SupportService` registers it lazily before the first `askWithWorkflow` call.

## Test

```sh
yarn test
```

The test starts the app, checks `/health`, validates the configured model, and checks the 0.9 concepts are visible through `Intelligence.inspect()`.

Intelligence and Platform come from GitHub Packages using the `next` tag. Update both together:

```sh
yarn up @3flows/intelligence@next @3flows/platform@next
```
