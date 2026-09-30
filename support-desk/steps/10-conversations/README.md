# Step 10 – Remember the conversation

`chat` continues one conversation per ticket (`conversations().conversation('ticket-<id>')`), with the prompt
`support.chat` and the ticket as context. Conversations are stored as entities; `transcript` reads them.

```sh
yarn step:10
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Brake pads","body":"The pads do not fit."}'
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"The brake pads don’t fit."}'
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"It’s the front one."}'
curl -X POST localhost:3000/transcript -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/remember-the-conversation
