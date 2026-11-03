# n8n ORCH Workflow Schema

Reusable n8n pattern: one workflow per ORCH block. Trigger feeds the ORCH JSON into an AI Agent; each STEPS entry becomes a tool-calling node; CHECK gates progression; FAIL routes to rollback and Slack alert.

## Node layout (auth-service release)

```
[Webhook: POST /orch/auth-release]
        |
        v
[Set: parse ORCH JSON] --> ORCH-BEGIN ... ORCH-END block
        |
        v
[AI Agent: system = ai/orch-system-prompt.txt]
  tools: health, backup, deploy, smoke
        |
        +--> [HTTP Request: health] --> [IF: status == 200] --no--> [Slack: ALERT]
        |                              |
        |                             yes
        |                              v
        +--> [Postgres: backup users] --> [IF: dump ok] --no--> [Slack: ALERT]
        |                              |
        |                             yes
        |                              v
        +--> [SSH/Docker: deploy tag] --> [IF: pod running] --no--> [FAIL: rollback prev tag + Slack]
        |                              |
        |                             yes
        |                              v
        +--> [HTTP Request: smoke login+refresh] --> [IF: JWT valid sub] --no--> [FAIL: rollback + Slack]
        |                              |
        |                             yes
        |                              v
        +--> [Slack/REPORT: version, duration, smoke result]
```

## Mapping rules

- ORCH.SKILLS -> n8n tool definitions (HTTP Request, Postgres, SSH nodes).
- ORCH.STEPS order -> node execution order; AI Agent calls tools sequentially.
- ORCH.DEPS -> IF-node gates: downstream node only runs if upstream CHECK passed.
- ORCH.PAR -> parallel branches via SplitInBatches or multiple outgoing connections.
- ORCH.CHECK -> IF condition on node output.
- ORCH.FAIL -> error output wired to rollback node + Slack alert.
- ORCH.ALERT -> Slack node (channel from ORCH.ALERT value).
- ORCH.REPORT -> final Set/Slack node summarizing version, duration, smoke result.

## Import notes

- Paste ORCH-BEGIN...ORCH-END as the webhook body or load from ai/orch-template.md.
- AI Agent node: set system prompt to contents of ai/orch-system-prompt.txt.
- Credentials: Postgres, SSH, Slack — store in n8n credentials, never in the workflow JSON.
- One workflow JSON per service; swap the ORCH block to reuse across projects.
