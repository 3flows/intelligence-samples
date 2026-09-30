# Step 09 – Triage in the background

`createTicket` stores the ticket and answers right away; triage runs from the `ticket-created` queue.
Retries are AI `defaults` in YAML. When triage fails anyway, the ticket gets status `triage-failed` and lands in `generalQueue`.

```sh
yarn step:09
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com", "subject": "Brake pads", "body": "The pads from A-1042 do not fit."
}'
curl -X POST localhost:3000/getTicket -H 'Content-Type: application/json' -d '{"id":"<id from above>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/triage-in-the-background
