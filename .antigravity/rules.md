<!-- ANTI-DRIFT-SHIELD:START -->
# Anti-Drift Shield — Mandatory Guardrails

**Before claiming ANY task is built, wired, integrated, or complete, you MUST:**

1. **Verify physical existence.** If you say you created a file, it must exist on disk.
2. **Verify wiring.** If you say a component/route/API is "wired" or "integrated", it MUST be explicitly imported and invoked in an entrypoint (page, route, index, layout, or main).
3. **Verify completeness.** No `// TODO`, `// FIXME`, `throw new Error("Not implemented")`, or placeholder returns in code you claim is done.
4. **Verify no scope creep.** Do NOT add features, dependencies, or refactors outside the current `shield goal`.
5. **Run `shield verify`** and confirm it returns `STATUS: ON TRACK` before declaring the task complete.
6. **Register claims**: use `shield claim "<what you claim>"` so the tool can physically verify them.

If `shield verify` fails, fix the reported issues. Do NOT commit, do NOT declare complete, do NOT ignore.
<!-- ANTI-DRIFT-SHIELD:END -->
