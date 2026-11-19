# Step 28 – Workflows

The intake of a ticket is a **workflow** ([`intake.ts`](intake.ts)): load, triage (with a retry), route by rule, and, only where a person has to take over, a brief from the case researcher. The queue runs it; `retryIntake` runs it again for a ticket whose triage failed. The report says how far it got, step by step.

```sh
yarn step:28
curl -X POST localhost:3000/retryIntake -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/workflows
