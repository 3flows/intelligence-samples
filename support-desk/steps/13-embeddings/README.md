# Step 13 – Embeddings

`HelpCenterService` splits articles into passages, embeds them and stores them in `vectors`. `searchArticles` finds them by meaning.

```sh
yarn step:13
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/13-embeddings/articles.json
curl -X POST localhost:3000/help-center/searchArticles -H 'Content-Type: application/json' -d '{"query":"how do I get my money back","limit":2}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/embeddings
