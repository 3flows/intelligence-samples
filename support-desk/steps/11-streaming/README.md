# Step 11 – Stream the answer

`POST /chat/stream` is an HTTP route that streams the assistant's answer as plain text while it's generated,
with `assistant(ticket).stream(message)`. The turn is stored like one from `chat`.

```sh
yarn step:11
curl -N -X POST localhost:3000/chat/stream -H 'Content-Type: application/json' \
  -d '{"ticketId":"<id>","message":"Which pads do I need for a Velo City 3?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/stream-the-answer
