# Step 31 – A console for the team

`desk-assistant` is an agent served to a frontend over AG-UI, on a server of its own (port 3002), with run routes and its card over HTTP. [`console.ts`](console.ts) gives it UI tools (`show_card`, …): the model asks for a card, the frontend renders it. The help center's tool is also offered as an MCP server (port 3003).

```sh
yarn step:31
curl -N -X POST localhost:3002/desk-assistant -H 'Content-Type: application/json' -d '{"threadId":"t1","runId":"r1","state":{"ticketId":"<id>"},"messages":[{"id":"m1","role":"user","content":"Where is the order of this ticket?"}]}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/a-console
