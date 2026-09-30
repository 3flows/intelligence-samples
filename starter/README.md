# Starter

An empty 3flows Intelligence project: one HTTP server, one model, no services yet. Copy it to start your own app,
or follow the tutorial from [Hello, model](https://3flows.github.io/intelligence-docs/docs/tutorial/hello-model).

Setup, step by step: https://3flows.github.io/intelligence-docs/docs/tutorial/setup

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
export OPENAI_API_KEY=<your key>   # only needed once something asks the model
yarn install
yarn start        # the platform starts; curl localhost:3000/health answers OK
yarn test         # needs no key
```

Intelligence and the platform come from GitHub Packages, tag `next`. `yarn up @3flows/intelligence@next @3flows/platform@next` updates both.
