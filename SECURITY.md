# Security Policy

## Reporting

Security issues should be reported privately to Adorbis LLC before public disclosure.

Do not include credentials, API keys, access tokens, or other secrets in public issues.

## Scope & Governance Boundaries

This adapter integrates INFUSE governance and MCP execution intelligence with Antigravity.

### Governed Execution Paths
* **Lifecycle Hook Interception (`PreToolUse`):** Intercepts configured tool operations (`run_command`, `execute_command`, `bash`, `write_file`, `edit_file`, `modify_file`, `read_file`, `read_resource`, `list_resources`) prior to host execution.
* **Deterministic Decision Enforcement:** Supports fail-closed local safety policies and remote authorization preflight checks returning `allow`, `deny`, or `ask` (human approval gate) decisions.
* **Verified Runtime Activation:** Verified against live Antigravity host runtime (`agy 1.4.5`) ensuring zero execution on policy denials.

### Platform Boundaries (Ungoverned Routes)
* **Native Model Inference & Spend:** Host LLM token generation and inference spend occur out-of-band and are not intercepted by tool lifecycle hooks.
* **Internal Subagent Orchestration:** Internal subagent dispatch (`invoke_subagent`, `define_subagent`, `manage_subagents`) is managed by host runtime loops and is not governed by tool lifecycle hooks.
* **Third-Party MCP Servers:** Direct host connections to external, third-party MCP servers do not route through pre-tool governance hooks.

Antigravity's native permission and approval mechanisms remain authoritative for host-side operations. No production credentials are embedded in this adapter.
