# Step 32 – Many at once

`retriage` triages every routed ticket again with `inference().collection(tickets)`: three at a time, a second attempt for failures, and a result for every ticket. The report says which tickets moved to another team and which failed.

```sh
yarn step:32
curl -X POST localhost:3000/retriage
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/many-at-once
