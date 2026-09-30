# Step 06 – Flag urgent tickets

`check('urgent')` flags tickets that need an answer today. The `queue` handler lists a department's tickets, urgent first.

```sh
yarn step:06
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Wheel not here",
  "body": "My race is on Saturday and the wheel I ordered still has not arrived!"
}'
curl -X POST localhost:3000/queue -H 'Content-Type: application/json' -d '{"department":"sales"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/flag-urgent-tickets
