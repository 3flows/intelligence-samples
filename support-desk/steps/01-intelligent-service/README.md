# Step 01 – An intelligent service

`SupportService` extends `IntelligenceService`, so its trigger context carries `inference()` next to the platform's `doc()`, `mq()` and `service()`. One handler asks the model; `ais` in YAML decides which model that is.

`IntelligenceService` and `handler` come from [`_shared/intelligence-service.ts`](../_shared/intelligence-service.ts), a preview of a proposed library change.

```sh
yarn step:01
curl -X POST localhost:3000/ask -H 'Content-Type: application/json' -d '{"question":"My new bike squeaks when I brake. What can I do?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/intelligent-service
