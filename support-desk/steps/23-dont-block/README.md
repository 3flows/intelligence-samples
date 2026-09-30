# Step 23 – Don't block, expect failure

`createTicket` answers right away; triage runs from the `ticket-created` queue with retries. A failed triage is status `triage-failed`, in `generalQueue`.

```sh
yarn step:23
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/dont-block
