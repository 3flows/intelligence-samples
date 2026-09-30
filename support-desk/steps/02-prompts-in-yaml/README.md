# Step 02 – Prompts in YAML

The instructions move into the `prompts` section of `intelligence.yml`: named, versioned, with variables.
The chain uses them with `.prompt('support.reply', { shop: 'Velo' })`.

```sh
yarn step:02
curl -X POST localhost:3000/draftReply -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Bremsen quietschen",
  "body": "Hallo, die Bremsen meines neuen Velo City 3 quietschen. Ist das normal?"
}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/prompts-in-yaml
