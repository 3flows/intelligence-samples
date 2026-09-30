# Step 14 – Answer from knowledge

Every chat turn retrieves four passages and sends them with `.with({ articles })`; `support.chat@v3` restricts policy answers to them; the answer returns `sources`.

```sh
yarn step:14
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/14-rag/articles.json
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"<id>","message":"Can I still return the helmet? I bought it five weeks ago."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/answer-from-knowledge
