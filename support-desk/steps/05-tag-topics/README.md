# Step 05 – Tag topics

Tickets get topics from a fixed list with `choice('topics').manyOf(Topic.options)`: zero, one or several. `topicReport` counts them.

```sh
yarn step:05
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "grace@example.com",
  "subject": "Wrong part and no invoice",
  "body": "The brake pads you sent do not fit my bike, and I never got an invoice."
}'
curl -X POST localhost:3000/topicReport
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/tag-topics
