# Step 19 – Guard the input

[`guardrails.ts`](guardrails.ts) screens chat messages before the assistant sees them: `moderation()`, and `check('payment-details')`. Failing messages get a fixed hand-over; the ticket gets status `needs-human`.

```sh
yarn step:19
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/guard-the-input
