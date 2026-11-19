# Step 27 – Skills and agents

A **skill** (`skills` in YAML) bundles instructions and tool references; an **agent** (`agents`) is a model that works on a task in several steps with them. `prepareCase` runs the `case-researcher` for a ticket and stores its brief; the tools it may use are `tool(...)` handlers, scoped by the ticket.

```sh
yarn step:27
curl -X POST localhost:3000/prepareCase -H 'Content-Type: application/json' -d '{"ticketId":"<id>"}'
```

Tutorial: https://3flows.github.io/intelligence-docs/docs/tutorial/skills-and-agents
