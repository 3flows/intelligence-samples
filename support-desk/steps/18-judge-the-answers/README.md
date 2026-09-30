# Step 18 – Judge the answers

[`judges.ts`](judges.ts): `check('grounded')` and `score('tone')`. `yarn eval:18` evaluates the real chat path on [`evals/questions.json`](evals/questions.json): retrieval, groundedness, tone.

```sh
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:18
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/judge-the-answers
