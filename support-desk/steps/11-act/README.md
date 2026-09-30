# Step 11 – Let it act

One tool, `lookupOrder`, scoped to the ticket's customer: the model chooses the order number, never whose orders it sees. `orders/seedOrders` loads A-1042, A-1044 (ada@example.com) and A-1043 (grace@example.com).

```sh
yarn step:11
curl -X POST localhost:3000/orders/seedOrders
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"Where is my order A-1042?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/act
