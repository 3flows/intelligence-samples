# Step 12 – Documents as context

Text attachments go into `blobs`; `withAttachments(chain, ticket)` adds them to the extraction and every chat turn.

```sh
yarn step:12
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Display error","body":"Log attached.","attachments":[{"name":"display.log","content":"ERR 503 motor sensor timeout"}]}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/documents-as-context
