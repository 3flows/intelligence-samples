# Step 18 – Guardrails

[`guardrails.ts`](guardrails.ts) screens every chat message before the assistant sees it: `moderation().check()`
for the provider's safety categories, `check('payment-details')` for our own red line. Failing messages get a fixed
hand-over answer and the ticket status `needs-human`. Triage routes automatically only with a confidence of 0.6 or more;
below, the ticket gets `needs-routing` and waits in `generalQueue` with the model's suggestion.

```sh
yarn step:18
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"<id>","message":"Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/guardrails
