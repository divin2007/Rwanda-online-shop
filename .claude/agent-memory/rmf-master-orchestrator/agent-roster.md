---
name: agent-roster
description: Exact RMF Claude Code agent and skill names confirmed from .claude/agents and .claude/skills (2026-06-06)
metadata:
  type: reference
---

Confirmed agent files in `.claude/agents/` and skills in `.claude/skills/` on 2026-06-06.

Coordinator/specialist agents:
- rmf-master-orchestrator (model opus) — boss; final approval
- rmf-research-intelligence (haiku) — external research engine
- rmf-ux-analyst (haiku) — human UX persona testing
- rmf-qa-commander (sonnet) — testing gatekeeper / release verdict

Worker agents (all sonnet, tools incl. Task/Read/Write/Edit/Grep/Glob/Bash; most also WebSearch/WebFetch; database worker has no web tools):
- rmf-worker-research, rmf-worker-backend, rmf-worker-frontend, rmf-worker-database, rmf-worker-security, rmf-worker-qa, rmf-worker-devops, rmf-worker-documentation, rmf-worker-integration, rmf-worker-performance

Skills (`.claude/skills/<name>/SKILL.md`):
- rmf-marketplace-ui-ux, rmf-frontend-design-system, rmf-security-review, rmf-payment-testing, rmf-delivery-rider-testing, rmf-api-contract-testing, rmf-performance-mobile-first, rmf-research-method

Research knowledge base: `.claude/research-knowledge-base/` has 00-project-identity.md and 01-system-architecture.md. Research provenance in `.claude/skills/RESEARCH-NOTES.md`.

**How to apply:** Always dispatch using these exact names. The roster in the system prompt uses generic labels ("Backend Worker"); the real invokable names are the `rmf-worker-*` slugs above.
