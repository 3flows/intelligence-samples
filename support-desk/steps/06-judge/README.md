# Step 06 – Judge

`check('urgent')` and `score('frustration').between(0, 10).criteria(...)` join the triage.

```sh
yarn step:06
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Wheel not here","body":"My race is on Saturday and the wheel still has not arrived!"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/judge
