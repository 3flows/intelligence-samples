# Step 00 – Hello, model

One handler asks the model and returns the answer. `ais` in YAML decides which model that is.

```sh
export OPENAI_API_KEY=<your key>
yarn step:00
curl -X POST localhost:3000/ask -H 'Content-Type: application/json' \
  -d '{"question":"My new bike squeaks when I brake. What can I do?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/hello-model
