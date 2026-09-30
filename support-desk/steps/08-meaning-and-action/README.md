# Step 08 – The model decides meaning, the code decides action

[`rules.ts`](rules.ts) turns the model's findings into a priority. `queue` lists a department's tickets, high priority first.

```sh
yarn step:08
curl -X POST localhost:3000/queue -H 'Content-Type: application/json' -d '{"department":"technical"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/meaning-and-action
