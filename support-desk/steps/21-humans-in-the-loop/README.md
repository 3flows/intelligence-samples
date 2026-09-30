# Step 21 – Humans in the loop

Unsure routing (confidence below 0.6) waits in `generalQueue`. `routeTicket` records the agent's decision; `evaluationCases` exports corrections as new evaluation cases.

```sh
yarn step:21
curl -X POST localhost:3000/generalQueue
curl -X POST localhost:3000/routeTicket -H 'Content-Type: application/json' -d '{"ticketId":"<id>","department":"technical"}'
curl -X POST localhost:3000/evaluationCases
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/humans-in-the-loop
