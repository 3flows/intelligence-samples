# 3flows Intelligence Samples

Runnable samples for [`@3flows/intelligence`](https://github.com/3flows/intelligence), which builds on the [3flows Platform](https://github.com/3flows/platform).

## Starter: the 0.9 learning-path app

[`starter/`](starter) is the primary sample application. It introduces the current Intelligence 0.9 building blocks in order:

```text
AIs → Fluent inference → Chatbots → Skills + agents → Workflows
```

| Building block | Where to look |
| --- | --- |
| `ais:` provider/model configuration | `starter/intelligence.yml` |
| Fluent `inference()` calls | `starter/support-service.ts` (`ask`, `triageTicket`) |
| Service tools | `starter/support-service.ts` (`lookupOrder`) |
| Chatbot configuration | `starter/intelligence.yml` (`chatbots.support`) |
| Skill configuration | `starter/intelligence.yml` (`skills.starter_support`) |
| Agent configuration and execution | `starter/intelligence.yml`, `SupportService.runAgent` |
| Workflow orchestration | `starter/workflows.ts`, `SupportService.askWithWorkflow` |

The docs follow the same path: https://3flows.github.io/intelligence-docs/docs/learning-path/

## Run the starter

You need Node.js 24+, Corepack and access to the 3flows packages on GitHub.

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
export OPENAI_API_KEY=<your key>
git clone https://github.com/3flows/intelligence-samples.git
cd intelligence-samples/starter
yarn install
yarn start
```

Health check:

```sh
curl localhost:3000/health
```

## Test

```sh
cd intelligence-samples/starter
yarn test
```

## Update dependencies

Intelligence and Platform should be updated together:

```sh
yarn up @3flows/intelligence@next @3flows/platform@next
```
