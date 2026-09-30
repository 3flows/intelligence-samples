# Step 15 – Answer from the help center

Retrieval-augmented generation: every chat turn retrieves the four most relevant help center passages and sends them
with `.with({ articles })`. The prompt `support.chat@v3` restricts policy answers to them; the answer returns their ids as `sources`.

```sh
yarn step:15
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/15-rag/articles.json
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Helmet","body":"Can I return my helmet?"}'
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"<id>","message":"Can I still return the helmet? I bought it five weeks ago."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/answer-from-the-help-center
