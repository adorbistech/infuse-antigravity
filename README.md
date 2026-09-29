# INFUSE for Antigravity

INFUSE provides execution intelligence and governance for autonomous AI agent workflows.

This Antigravity integration connects Antigravity to the existing INFUSE Remote MCP service and provides an INFUSE governance skill for agent-driven software work.

## What It Provides

* INFUSE Remote MCP connectivity
* Execution governance guidance
* Project and contract preservation
* Explicit approval boundaries
* Regression discipline
* Runtime execution visibility through INFUSE MCP

## Architecture

```text
Antigravity
    |
    +-- INFUSE Governance Skill
    |
    +-- Remote MCP
            |
            v
https://infuse-api.adorbistech.com/mcp
            |
            v
        INFUSE
Execution Intelligence
and Governance Layer
```

## Installation

Install the `infuse-antigravity` plugin in Antigravity.

The plugin uses the existing public INFUSE MCP endpoint:

https://infuse-api.adorbistech.com/mcp

No API credentials are embedded in this repository.

## Governance

The included governance skill instructs agent workflows to:

1. Preserve approved visual and functional contracts.
2. Maintain project boundaries.
3. Respect frozen system layers.
4. Require explicit approval for consequential operations.
5. Validate live behavior and failure states.
6. Run regression checks before completion.

## Security

This adapter contains no API keys, tokens, passwords, private certificates, or other credentials.

The adapter does not replace Antigravity's native permission or approval controls.

## Links

* INFUSE: https://infuse.adorbistech.com/
* INFUSE MCP: https://infuse-api.adorbistech.com/mcp
* INFUSE Core: https://github.com/adorbistech/infuse
* Antigravity Adapter: https://github.com/adorbistech/infuse-antigravity

## License

Apache-2.0
