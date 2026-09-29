---
name: infuse-governance
description: Apply INFUSE execution governance when planning, modifying, testing, or reviewing agent-driven software work. Use this skill to preserve approved contracts, project maps, ownership boundaries, explicit approval gates, and regression discipline.
---

# INFUSE Governance

Use INFUSE as the execution-governance layer for agent workflows.

## Operating Rules

1. Treat the approved visual and functional contracts as authoritative.
2. Maintain a clear project map before broad changes.
3. Separate reference artifacts from production code.
4. Respect frozen layers and existing system boundaries.
5. Require explicit approval for destructive, production-impacting, security-sensitive, billable, or irreversible operations.
6. Verify live data wiring and failure states, not only static implementation.
7. Run regression checks before declaring a task complete.

## Completion Condition

A change is complete only when the approved visual contract, functional contract, live data wiring, failure states, and deployed behavior agree.

## Antigravity Scope

This skill complements Antigravity's agent execution. It does not replace the host's permissions, review flow, or safety controls.
