# Starter

An empty 3flows Intelligence project: one HTTP server, one model, no services yet. Copy it to start your own app,
or follow the tutorial from [An intelligent service](https://3flows.github.io/intelligence-docs/docs/tutorial/intelligent-service).

Setup, step by step: https://3flows.github.io/intelligence-docs/docs/tutorial/setup

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
export OPENAI_API_KEY=<your key>   # only needed once something asks the model
yarn install
yarn start        # the platform starts; curl localhost:3000/health answers OK
yarn test         # needs no key
```

Intelligence and the platform come from GitHub Packages, pinned to exact versions in `package.json`. To move to a newer build, change both together: the Platform version is the one that Intelligence build depends on.
