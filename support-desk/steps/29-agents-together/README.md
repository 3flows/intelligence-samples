# Step 29 – Agents that work together

The case researcher gets a colleague: `policy-advisor`, an agent of its own with the help center as its only tool. `peers` gives the researcher a tool to ask it (`ask_policy_advisor`); `delegation` limits how often and how deep. Agents have cards: `team` lists the discoverable ones, or finds them by capability.

```sh
yarn step:29
curl -X POST localhost:3000/team -H 'Content-Type: application/json' -d '{"capability":"warranty"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/agents-together
