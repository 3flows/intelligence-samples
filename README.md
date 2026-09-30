# 3flows Intelligence Samples

Runnable samples for [`@3flows/intelligence`](https://github.com/3flows/intelligence), which builds on the
[3flows Platform](https://github.com/3flows/platform). The samples back the tutorial in the
[intelligence documentation](https://3flows.github.io/intelligence-docs/).

## Support desk

The support desk of Velo, a small bike shop, growing step by step: from a first question to a model, to tickets that are
routed, tagged and extracted into data, a chat with memory, tools and the help center, and finally one model per job,
guardrails and a record of every model call. Every step continues from the one before it.

| Step | Concept |
|---|---|
| **Part 1: Ask the model** | |
| [00-hello-model](support-desk/steps/00-hello-model) | `ais`, `chat().ask()` |
| [01-give-it-a-job](support-desk/steps/01-give-it-a-job) | `instructions`, `with`, immutable chains |
| [02-prompts-in-yaml](support-desk/steps/02-prompts-in-yaml) | `prompts`: named, versioned, with variables |
| [03-test-without-a-model](support-desk/steps/03-test-without-a-model) | A scripted provider: tests without a model |
| **Part 2: Turn language into data** | |
| [04-route-tickets](support-desk/steps/04-route-tickets) | `choice().oneOf()` |
| [05-tag-topics](support-desk/steps/05-tag-topics) | `choice().manyOf()` |
| [06-flag-urgent](support-desk/steps/06-flag-urgent) | `check()` |
| [07-measure-frustration](support-desk/steps/07-measure-frustration) | `score()` |
| [08-extract-triage](support-desk/steps/08-extract-triage) | `extract().schema()` |
| [09-background-triage](support-desk/steps/09-background-triage) | Model calls from a queue, retries, failure as a state |
| **Part 3: Talk and act** | |
| [10-conversations](support-desk/steps/10-conversations) | `conversations()`, stored as entities |
| [11-streaming](support-desk/steps/11-streaming) | `stream()` over HTTP |
| [12-tools](support-desk/steps/12-tools) | Tools: a scoped order lookup |
| [13-attachments](support-desk/steps/13-attachments) | Files from `blobs` with `withBlob()` |
| **Part 4: Answer from knowledge** | |
| [14-embeddings](support-desk/steps/14-embeddings) | `embedding()` and the platform's `vectors` |
| [15-rag](support-desk/steps/15-rag) | Retrieval-augmented generation with sources |
| [16-rerank](support-desk/steps/16-rerank) | `reranker()` |
| **Part 5: Operate it** | |
| [17-models-per-job](support-desk/steps/17-models-per-job) | Several `ais`, `.model()`, defaults |
| [18-guardrails](support-desk/steps/18-guardrails) | `moderation()`, policy `check()`s, confidence gates |
| [19-observability](support-desk/steps/19-observability) | Inference runs, `.metadata()`, tracers |

**Tests need no model and no key.** Every step's test runs the step's real YAML with every AI replaced by a scripted
provider ([`_shared/scripted-ai.ts`](support-desk/steps/_shared/scripted-ai.ts), [`_shared/offline.ts`](support-desk/steps/_shared/offline.ts)).
All platform providers are `memory`, so no database, broker or vector store is needed either.

**Running a step** talks to a real model: OpenAI by default (`OPENAI_API_KEY`), a Jina reranker from step 16 (`JINA_API_KEY`).
Or switch the `ais` entries to a [local model](https://3flows.github.io/intelligence-docs/docs/guides/local-models) with Ollama or LM Studio.

## Start your own project

[`starter/`](starter) is an empty project: `package.json`, `tsconfig.json`, `.yarnrc.yml`, one HTTP server, one model and a test.
Copy it, or follow the [setup page](https://3flows.github.io/intelligence-docs/docs/tutorial/setup) of the tutorial.

## Run

You need Node.js 24+, Corepack (it ships with Node.js) and access to the 3flows repositories on GitHub.
Intelligence and the platform come from GitHub Packages (`@3flows/intelligence@next`, `@3flows/platform@next`),
which needs a GitHub token with `read:packages`.

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
git clone https://github.com/3flows/intelligence-samples.git
cd intelligence-samples/support-desk
yarn install
yarn test                 # every step, offline
export OPENAI_API_KEY=<your key>
yarn step:08              # a single step, with a real model
```

To pick up newer `next` builds: `yarn up @3flows/intelligence@next @3flows/platform@next`.
