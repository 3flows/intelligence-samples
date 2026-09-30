# Step 13 – Read attachments

Tickets take text attachments. They're stored in `blobs` under `attachments/<ticket>/<name>`, and
`withAttachments(chain, ticket)` adds them to the extraction and to every chat turn with `withBlob(...)`.

```sh
yarn step:13
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Display error",
  "body": "My e-bike display shows an error, log attached.",
  "attachments": [{ "name": "display.log", "content": "08:12:01 ERR 503 motor sensor timeout" }]
}'
```

Text files only for now: the bundled providers don't take images or PDFs in chat yet.

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/read-attachments
