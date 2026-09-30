# Step 03 – Prompts as configuration

The instructions move into `prompts` in YAML: named, versioned, with variables. `.prompt('support.reply', { shop: 'Velo' })`.

```sh
yarn step:03
curl -X POST localhost:3000/draftReply -H 'Content-Type: application/json' -d '{"email":"ada@example.com","subject":"Brake pads do not fit","body":"The brake pads from order A-1042 do not fit my Velo City 3."}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/prompts-as-configuration
