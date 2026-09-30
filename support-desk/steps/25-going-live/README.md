# Step 25 – Going live

[`intelligence.production.yml`](intelligence.production.yml): MongoDB, Azure Blob Storage, RabbitMQ, same services, prompts and AIs; a parity test keeps it that way. `closeTicket` deletes the ticket's conversation.

```sh
yarn step:25                                            # development, memory providers
node dist/steps/25-going-live/main.production.js         # with MONGO_URL, AZURE_STORAGE_CONNECTION_STRING, AMQP_URL, keys
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/going-live
