# Step 16 – Rerank

`searchArticles` takes 3 × `limit` candidates from the vector index and keeps the best `limit` by a reranker
(`reranker().query(q).with(candidates, mapper).topK(limit).rank()`). The chat doesn't change.

```sh
export JINA_API_KEY=<your key>
yarn step:16
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/16-rerank/articles.json
curl -X POST localhost:3000/help-center/searchArticles -H 'Content-Type: application/json' \
  -d '{"query":"my e-bike battery drains fast in winter","limit":2}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/rerank
