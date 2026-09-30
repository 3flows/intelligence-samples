# Step 01 – Give it a job

`draftReply` drafts a reply to a ticket: instructions (policy), the ticket as input (data), and a question (task).

```sh
yarn step:01
curl -X POST localhost:3000/draftReply -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Brakes squeak",
  "body": "Hi, my Velo City 3 is two weeks old and the brakes squeak loudly. Is this normal?"
}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/give-it-a-job
