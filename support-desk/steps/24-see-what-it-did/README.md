# Step 24 – See what it did

`.metadata({ purpose, subjectType, subjectId })` on every call links it to its ticket. With the `IntelligenceTrace` domain registered, every call is a queryable record: `ticketUsage` sums tokens per job, `explain` lists the calls. Optional MLflow traces under `tracers`.

```sh
yarn step:24
curl -X POST localhost:3000/ticketUsage -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/see-what-it-did
