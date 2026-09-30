# Step 22 – The right model for each job

`DEFAULT` (`gpt-4.1`) for replies, `triage` (`gpt-4.1-nano`, temperature 0) for triage, checks and judges. `yarn eval:22` says whether the cheaper model is good enough.

```sh
OPENAI_API_KEY=<key> yarn eval:22
LOCAL_MODEL=qwen/qwen3-coder-next LOCAL_MODEL_TRIAGE=<smaller model> yarn eval:22
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/the-right-model-for-each-job
