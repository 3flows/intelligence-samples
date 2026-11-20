# Step 30 – Confirm before acting

`send_return_label` is a tool with `requiresConfirmation`. When the case researcher asks for it, the tool doesn't run: the run waits, and the brief says what it's waiting for. `decideCase` resumes the run with a yes, or stops it with a no.

```sh
yarn step:30
curl -X POST localhost:3000/decideCase -H 'Content-Type: application/json' -d '{"ticketId":"<id>","approve":true}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/confirm-before-acting
