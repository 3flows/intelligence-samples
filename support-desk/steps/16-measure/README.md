# Step 16 – Measure before you improve

[`evals/tickets.json`](evals/tickets.json): 30 real-looking tickets with the team's decisions. `yarn eval:16` runs them through `triage()` with a real model and counts. Not part of `yarn test`.

```sh
OPENAI_API_KEY=<key> yarn eval:16
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:16     # or with LM Studio
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/measure
