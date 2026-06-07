---
name: runtime-no-subagent-spawn
description: In this harness the orchestrator cannot spawn rmf-worker-* subagents — no Task/dispatch tool exists; do the work directly
metadata:
  type: project
---

The `rmf-worker-*` agents exist as definition files in `.claude/agents/` but in this Claude Code harness there is NO tool to programmatically spawn them as independent subagent processes. ToolSearch for "Task"/"subagent dispatch" returns no spawn tool — only TaskCreate/TaskUpdate/TaskList (a todo board, not an agent runtime), Cron, Monitor, RemoteTrigger, Worktree.

**Why:** The system prompt is written as if the orchestrator delegates to live subagents, but the actual runtime does not provide that capability. Fabricating worker reports would violate the "never fabricate / always document reality" commandments.

**How to apply:** When a mission says "dispatch worker X," execute the work DIRECTLY using Read/Edit/Write/Bash/Grep, but keep the worker discipline: follow each worker's file ownership, apply the Step-7 review checklist as a self-gate, and present results honestly as "implemented directly (no subagent runtime available)." Use the TaskCreate board to track waves/files. Do NOT invent worker report text as if a separate agent produced it.
