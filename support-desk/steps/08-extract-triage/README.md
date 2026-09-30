# Step 08 – Extract a triage record

`extract('facts').schema(Facts)` pulls the order number, product and a summary out of the ticket.
All triage questions move to [`triage.ts`](triage.ts) – the desk's AI policy in one file – and run in parallel.

```sh
yarn step:08
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Brake pads do not fit",
  "body": "Hi, the brake pads from order A-1042 do not fit my Velo City 3. Can you send the right ones?"
}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/extract-a-triage-record
