# Step 03 – Test without a model

No code changes: this step is about its test. The tests run the step's real YAML with every AI replaced
by the scripted provider in [`_shared/scripted-ai.ts`](../_shared/scripted-ai.ts), using
[`_shared/offline.ts`](../_shared/offline.ts). They check what is sent to the model and what happens with the answer.

```sh
yarn test
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/test-without-a-model
