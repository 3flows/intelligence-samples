# Step 26 – A chatbot

The shop's public help chat is a **chatbot**: configured in YAML under `chatbots`, with its own sessions and history (`IntelligenceChatbot` domain), on its own HTTP server. `searchArticles` becomes a `tool(...)`, so the chatbot can be given the help center's public tools.

```sh
yarn step:26
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/26-a-chatbot/articles.json
curl -X POST localhost:3001/shop/conversation                     # starts a session, answers with the greeting and a conversationId
curl -X POST "localhost:3001/shop/conversation/<conversationId>" -H 'Content-Type: application/json' -d '{"message":"Can I return a helmet?"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/a-chatbot
