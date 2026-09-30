# Step 09 – Remember the conversation

`chat` continues one conversation per ticket (`conversations().conversation('ticket-<id>')`), stored as entities. `transcript` reads it.

```sh
yarn step:09
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"The brake pads don’t fit."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/remember
