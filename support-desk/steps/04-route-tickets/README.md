# Step 04 – Route tickets

`createTicket` stores tickets in `docs`, routed by `choice('department').oneOf(departments)` to billing, technical or sales.

```sh
yarn step:04
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Charged twice",
  "body": "I ordered a helmet last week and my card was charged twice."
}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/route-tickets
