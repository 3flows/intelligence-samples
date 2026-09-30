# Step 12 – Let it look things up

The chat assistant gets one tool, `lookupOrder`. It calls the `OrdersService` handler – but only with the ticket
customer's email: the model chooses the order number, never whose orders it sees.
`seedOrders` loads three sample orders (A-1042 and A-1044 belong to ada@example.com, A-1043 to grace@example.com).

```sh
yarn step:12
curl -X POST localhost:3000/orders/seedOrders
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Order","body":"Where is my order?"}'
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"Where is my order A-1042?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/let-it-look-things-up
