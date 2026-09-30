# Step 10 – Stream the answer

`POST /chat/stream` streams the assistant's answer as plain text.

```sh
yarn step:10
curl -N -X POST localhost:3000/chat/stream -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"Which pads do I need?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/stream
