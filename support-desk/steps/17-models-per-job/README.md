# Step 17 – The right model for each job

Two chat AIs: `DEFAULT` (`gpt-4.1`) for conversations and replies, `triage` (`gpt-4.1-nano`, temperature 0) for decisions.
[`triage.ts`](triage.ts) asks for it with `.model('triage')`; which model that is stays a YAML decision.

```sh
yarn step:17
```

Try `provider: anthropic` for `DEFAULT`, or `provider: ollama` for local development: the code doesn't change.

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/the-right-model-for-each-job
