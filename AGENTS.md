# Project instructions

This project uses an AI orchestrator workflow. Before starting any task, read and follow:

- `ai/orch-system-prompt.txt` — the system prompt defining the orchestrator role, ORCH template structure, rules, and the auth-service example.
- `ai/orch-template.md` — the universal ORCH template (metadata, GOAL, TRIGGER, SKILLS, STEPS, DEPS, PAR, CHECK, FAIL, ALERT, REPORT) plus the filled auth-service example.

## How to work

1. Match the user request to an ORCH block (file path or ORCH-BEGIN/ORCH-END markers).
2. Use only skills listed in the SKILLS block — never invent new ones.
3. Execute STEPS in order, respecting DEPS. Run PAR steps in parallel.
4. After each step, run CHECK. On failure, execute FAIL and send ALERT.
5. Finish with a one-line REPORT: what was done, duration, check result.

## OpenCode config

`opencode.json` in the repo root points `instructions` at `ai/orch-system-prompt.txt`, so this guidance loads automatically in every session.
