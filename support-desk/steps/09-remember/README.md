# Step 09 – Remember

The chat of a ticket is the app's own record ([`chat.ts`](chat.ts), in `docs`). `chat` sends the last messages along with every question (`.messages(...)`, `History.window`), and stores the new turn. `transcript` reads the record.

```sh
yarn step:09
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"The brake pads don’t fit."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/remember
