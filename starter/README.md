# Starter: Intelligence 0.9 building blocks

This starter is the sample application for the Intelligence 0.9 learning path. It shows the building blocks in the order you normally learn/use them:

```text
AIs → Fluent inference → Chatbots → Skills + agents → Workflows
```

## Files

| File | Purpose |
| --- | --- |
| `intelligence.yml` | All configuration: AIs, prompts, chatbot, skill, agent, storage, HTTP exposure |
| `support-service.ts` | Application behavior: handlers, Fluent inference calls, model-facing tools, agent/workflow entry points |
| `workflows.ts` | Code-defined workflow using Fluent inference as a step |
| `main.ts` | Imports services and starts Intelligence |
| `main.test.ts` | Smoke tests for the configured runtime |

## The path through the app

### 1. Configure AIs

`intelligence.yml` defines `ais:`. This answers: **which model capabilities can the app use?**

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
```

`SupportService.describeChatAI` inspects the selected chat AI.

### 2. Use the inference API from a service

`SupportService.ask` uses Fluent chat for a direct application-owned model call.

`SupportService.triageTicket` uses `choice()` so code receives typed data instead of parsing text.

### 3. Expose a chatbot

`chatbots.support` exposes a human-facing session chatbot at `/support`. It has bounded history and can discover public tools from `SupportService`.

Use this when an external human needs a session-style assistant.

### 4. Add skills and agents

`skills.starter_support` is a reusable capability bundle: instructions plus tool references.

`agents.starter_agent` is a task/run harness using that skill, service tools, policy, and workspace memory.

`SupportService.runAgent` starts it and returns the run id/status.

### 5. Orchestrate with workflows

`workflows.ts` defines `starter.quickAnswer`. `SupportService.askWithWorkflow` registers and runs it.

Use workflows for known multi-step business processes with reports, branches, waits, retries, and timeouts.

## Run

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
export OPENAI_API_KEY=<your key>
yarn install
yarn start
```

Health check:

```sh
curl localhost:3000/health
```

## Test

```sh
yarn test
```

The tests start the app and inspect configuration. Real model calls require `OPENAI_API_KEY`.

## Learn more

Read the docs learning path in `intelligence-docs`:

1. Configure AIs
2. Use Fluent inference
3. Add a chatbot
4. Add skills and agents
5. Orchestrate with workflows

Update dependencies together:

```sh
yarn up @3flows/intelligence@next @3flows/platform@next
```
