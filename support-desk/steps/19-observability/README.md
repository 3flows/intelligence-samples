# Step 19 – See what the model did

Every model call is recorded as an `AIInferenceRun` (the conversations ontology is registered since step 10).
`.metadata({ ticketId, job })` on every chain links the runs to tickets: `ticketUsage` sums the tokens per job,
`explain` lists the calls with AI, model and prompt versions. Optional MLflow traces are configured under `tracers`.

```sh
yarn step:19
# create a ticket and chat, as in the earlier steps, then:
curl -X POST localhost:3000/ticketUsage -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
curl -X POST localhost:3000/explain -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/see-what-the-model-did
