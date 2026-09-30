# Step 14 – Embeddings

`HelpCenterService` splits help center articles into passages, embeds them with the `embeddings` AI and
stores them in the platform's `vectors`. `searchArticles` finds passages by meaning.

```sh
yarn step:14
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/14-embeddings/articles.json
curl -X POST localhost:3000/help-center/searchArticles -H 'Content-Type: application/json' -d '{"query":"how do I get my money back","limit":2}'
```

(The tests use a scripted embedding based on letter frequencies, so they search with passage text, not with paraphrases.)

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/embeddings
