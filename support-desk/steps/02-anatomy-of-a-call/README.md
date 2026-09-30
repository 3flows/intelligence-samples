# Step 02 – Anatomy of a call

`draftReply`: instructions (policy), the ticket as input (data), a question (task). Chains are immutable.

```sh
yarn step:02
curl -X POST localhost:3000/draftReply -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Brake pads do not fit","body":"The brake pads from order A-1042 do not fit my Velo City 3."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/anatomy-of-a-call
