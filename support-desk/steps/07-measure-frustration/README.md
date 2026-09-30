# Step 07 – Measure frustration

`score('frustration').between(0, 10).criteria(...)` measures how the customer feels. `priorityOf` – our rule, not the model's – turns urgency and frustration into a priority.

```sh
yarn step:07
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "linus@example.com",
  "subject": "THIRD TIME",
  "body": "This is the third time I am writing about my derailleur. Nobody answers. I want my money back."
}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/measure-frustration
