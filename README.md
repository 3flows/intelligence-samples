# 3flows Intelligence Samples

Runnable samples for [`@3flows/intelligence`](https://github.com/3flows/intelligence), which builds on the
[3flows Platform](https://github.com/3flows/platform). The samples back the tutorial in the
[intelligence documentation](https://3flows.github.io/intelligence-docs/).

## Support desk

The support desk of Velo, a small bike shop, in six parts. Every step continues from the one before it.

| Step | Concept |
|---|---|
| **Part 1: Your first intelligent service** | |
| [01-intelligent-service](support-desk/steps/01-intelligent-service) | `IntelligenceService`, `trigger.context.inference()`, `ais` |
| [02-anatomy-of-a-call](support-desk/steps/02-anatomy-of-a-call) | Instructions, input, question; immutable chains |
| [03-prompts-as-configuration](support-desk/steps/03-prompts-as-configuration) | `prompts`: named, versioned, with variables |
| [04-swap-and-test](support-desk/steps/04-swap-and-test) | Another provider, a local model, and tests without a model |
| **Part 2: Turn language into data** | |
| [05-choose](support-desk/steps/05-choose) | `choice().oneOf()`, `.manyOf()` |
| [06-judge](support-desk/steps/06-judge) | `check()`, `score()` |
| [07-extract](support-desk/steps/07-extract) | `extract().schema()` |
| [08-meaning-and-action](support-desk/steps/08-meaning-and-action) | Business rules in code, fed by decisions |
| **Part 3: Converse and act** | |
| [09-remember](support-desk/steps/09-remember) | `conversations()`, stored as entities |
| [10-stream](support-desk/steps/10-stream) | `stream()` over HTTP |
| [11-act](support-desk/steps/11-act) | Tools, scoped to the customer |
| **Part 4: Give it knowledge** | |
| [12-documents-as-context](support-desk/steps/12-documents-as-context) | Files from `blobs` with `withBlob()` |
| [13-embeddings](support-desk/steps/13-embeddings) | `embedding()` and the platform's `vectors` |
| [14-rag](support-desk/steps/14-rag) | Retrieval-augmented generation with sources |
| [15-rerank](support-desk/steps/15-rerank) | `reranker()` |
| **Part 5: Quality and guardrails** | |
| [16-measure](support-desk/steps/16-measure) | An evaluation set and `yarn eval:16` |
| [17-improve-with-evidence](support-desk/steps/17-improve-with-evidence) | Targeted changes, compared with the baseline |
| [18-judge-the-answers](support-desk/steps/18-judge-the-answers) | The model as judge: grounded, tone |
| [19-guard-the-input](support-desk/steps/19-guard-the-input) | `moderation()`, policy checks, hand-over |
| [20-guard-the-output](support-desk/steps/20-guard-the-output) | Review every reply before it's sent |
| [21-humans-in-the-loop](support-desk/steps/21-humans-in-the-loop) | Confidence gates, corrections as evaluation cases |
| **Part 6: Run it in production** | |
| [22-model-per-job](support-desk/steps/22-model-per-job) | Several `ais`, `.model()`, an evaluation decides |
| [23-dont-block](support-desk/steps/23-dont-block) | `mq`, retries, failure as a state |
| [24-see-what-it-did](support-desk/steps/24-see-what-it-did) | Inference runs, `.metadata()`, tracers |
| [25-going-live](support-desk/steps/25-going-live) | Production YAML, a parity test, retention |

**Tests need no model and no key.** Every step's test runs the step's real YAML with every AI replaced by a scripted
provider ([`_shared/scripted-ai.ts`](support-desk/steps/_shared/scripted-ai.ts), [`_shared/offline.ts`](support-desk/steps/_shared/offline.ts)).
All platform providers are `memory`, so no database, broker or vector store is needed either.

**Running a step** talks to a real model: OpenAI by default (`OPENAI_API_KEY`), a Jina reranker from step 15 (`JINA_API_KEY`).
Or a [local model](https://3flows.github.io/intelligence-docs/docs/guides/local-models): `yarn step:04:local` runs on LM Studio.

**Evaluations** (Part 5) run a step against a real model and count how often it agrees with the team:

```sh
OPENAI_API_KEY=<key> yarn eval:16                      # triage, 30 tickets
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:17         # after the improvements, compared with step 16
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:18         # answers: retrieval, grounded, tone
```

`LOCAL_MODEL` runs every chat AI in LM Studio; see [`_shared/real.ts`](support-desk/steps/_shared/real.ts).

**A preview:** `IntelligenceService` and `handler` come from [`_shared/intelligence-service.ts`](support-desk/steps/_shared/intelligence-service.ts),
a change proposed for `@3flows/intelligence` that puts `inference()`, `conversations()` and `prompts()` into the trigger context.
Once the library ships it, only the import changes.

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
yarn step:01              # a single step, with a real model
```

To pick up newer `next` builds: `yarn up @3flows/intelligence@next @3flows/platform@next`.
