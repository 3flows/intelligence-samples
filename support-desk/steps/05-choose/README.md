# Step 05 – Choose

Tickets are stored with a triage record. [`triage.ts`](triage.ts) asks `choice('department').oneOf(departments)` and `choice('topics').manyOf(Topic.options)`. From here on, each chapter of Part 2 only changes `triage.ts`.

```sh
yarn step:05
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Brake pads do not fit","body":"The brake pads from order A-1042 do not fit my Velo City 3."}'
curl -X POST localhost:3000/topicReport
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/choose
