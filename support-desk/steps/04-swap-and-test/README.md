# Step 04 – Swap the model, test without one

`intelligence.local.yml` runs the same service on a local model in LM Studio. The tests run both YAMLs offline, with every AI replaced by the scripted provider ([`_shared/scripted-ai.ts`](../_shared/scripted-ai.ts), [`_shared/offline.ts`](../_shared/offline.ts)).

```sh
yarn step:04          # OpenAI
yarn step:04:local    # LM Studio, with qwen/qwen3-coder-next loaded
yarn test
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/swap-and-test
