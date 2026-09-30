# Step 07 – Extract

`extract('facts').schema(Facts)`: order number, product and a summary, with `nullable()` for what may be missing.

```sh
yarn step:07
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Brake pads do not fit","body":"The brake pads from order A-1042 do not fit my Velo City 3."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/extract
