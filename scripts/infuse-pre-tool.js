#!/usr/bin/env node
/**
 * INFUSE Pre-Tool Execution Governance Hook
 * 
 * Intercepts tool execution requests in Antigravity before they run.
 * Enforces policy gates, detects destructive/unauthorized actions,
 * supports remote preflight checks (with fail-closed semantics),
 * redacts secrets, and returns deterministic allow/deny/ask decisions.
 */

const path = require('path');

// Patterns for secret redaction
const SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{8,})['"]?/gi,
  /bearer\s+([a-zA-Z0-9_\-\.]{16,})/gi,
  /password\s*[:=]\s*['"]?([^'"\s]{6,})['"]?/gi,
  /token\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{8,})['"]?/gi,
];

function redactSecrets(text) {
  if (typeof text !== 'string') return text;
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      const prefix = match.split(/[:=\s]/)[0];
      return `${prefix}=[REDACTED]`;
    });
  }
  return redacted;
}

// Prohibited destructive commands (Hard Deny)
const HARD_DENY_COMMANDS = [
  /\brm\s+-[rf]*\s+[\/~]/i,            // Root or home directory removal
  /\bmkfs\b/i,                         // Filesystem formatting
  /\bdd\s+if=/i,                       // Raw disk write
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // Fork bomb
  /\bgit\s+reset\s+--hard\b/i,          // Hard git reset (violates audit preservation)
  /\bgit\s+clean\b/i,                   // Git clean (prohibited under preservation baseline)
  /\bgit\s+push\s+.*--force\b/i,        // Force push
];

// Protected files/paths (Frozen layers / Sensitive targets)
const PROTECTED_PATH_PATTERNS = [
  /\.env(\.production|\.local)?$/i,
  /\.shield\/archives/i,
  /id_rsa|id_ed25519/i,
];

// Consequential commands requiring human approval (Ask)
const ASK_COMMANDS = [
  /\bgit\s+push\b/i,
  /\bnpm\s+publish\b/i,
  /\bpip\s+upload\b/i,
  /\bdocker\s+push\b/i,
  /\bterraform\s+apply\b/i,
];

function normalizeTargetPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  return path.normalize(rawPath).replace(/\\/g, '/');
}

function evaluateLocalPolicy(toolCall, context = {}) {
  if (!toolCall || !toolCall.name) {
    return {
      decision: 'deny',
      reason: 'INFUSE Governance: Malformed tool call missing tool name (fail-closed).'
    };
  }

  const toolName = toolCall.name.toLowerCase();
  const args = toolCall.args || toolCall.arguments || toolCall.input || toolCall.parameters || {};

  // 1. Evaluate run_command / execute_command
  if (toolName === 'run_command' || toolName === 'execute_command' || toolName === 'bash') {
    const cmd = args.CommandLine || args.command || args.cmd || '';
    if (!cmd || typeof cmd !== 'string' || !cmd.trim()) {
      return {
        decision: 'deny',
        reason: 'INFUSE Governance: Empty or invalid command line provided (fail-closed).'
      };
    }

    // Split compound commands (&&, ||, ;, |) or check raw string
    const subCommands = cmd.split(/&&|\|\||;|\||\n/).map(c => c.trim()).filter(Boolean);

    for (const subCmd of [cmd, ...subCommands]) {
      // Check Hard Deny
      for (const pattern of HARD_DENY_COMMANDS) {
        if (pattern.test(subCmd)) {
          return {
            decision: 'deny',
            reason: `INFUSE Governance [Policy Block]: Command violates security baseline rule: destructive or history-altering operation detected.`
          };
        }
      }

      // Check Ask / Gated
      for (const pattern of ASK_COMMANDS) {
        if (pattern.test(subCmd)) {
          return {
            decision: 'ask',
            reason: `INFUSE Governance [Approval Gate]: Consequential publication/deployment command requires human authorization: "${redactSecrets(cmd).slice(0, 80)}"`,
            permissionOverrides: [`command(${subCmd.slice(0, 60)})`]
          };
        }
      }
    }

    // Safe command allowed
    return {
      decision: 'allow',
      reason: 'INFUSE Governance: Command verified against security policies.'
    };
  }

  // 2. Evaluate write_file / edit_file
  if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'modify_file') {
    const rawPath = args.Path || args.path || args.filePath || '';
    const targetPath = normalizeTargetPath(rawPath);
    if (!targetPath) {
      return {
        decision: 'deny',
        reason: 'INFUSE Governance: File modification missing target Path (fail-closed).'
      };
    }

    // Check Protected Paths (including normalized path and base name)
    for (const pattern of PROTECTED_PATH_PATTERNS) {
      if (pattern.test(targetPath) || pattern.test(path.basename(targetPath))) {
        return {
          decision: 'deny',
          reason: `INFUSE Governance [Frozen Layer]: Modification of protected path is prohibited: "${targetPath}".`
        };
      }
    }

    return {
      decision: 'allow',
      reason: 'INFUSE Governance: File modification path verified.'
    };
  }

  // 3. Evaluate read_file / search_web / list_resources (Read-only tools)
  if (toolName === 'read_file' || toolName === 'read_resource' || toolName === 'search_web' || toolName === 'list_resources') {
    const rawPath = args.Path || args.path || '';
    const targetPath = normalizeTargetPath(rawPath);
    if (targetPath) {
      for (const pattern of PROTECTED_PATH_PATTERNS) {
        if ((pattern.test(targetPath) || pattern.test(path.basename(targetPath))) && /id_rsa|id_ed25519|\.env\.production/.test(targetPath)) {
          return {
            decision: 'deny',
            reason: `INFUSE Governance [Secret Containment]: Reading private credential path is blocked: "${targetPath}".`
          };
        }
      }
    }

    return {
      decision: 'allow',
      reason: 'INFUSE Governance: Read-only tool execution permitted.'
    };
  }

  // 4. Unknown tools are not implicitly trusted.
  return {
    decision: 'deny',
    reason: `INFUSE Governance [Fail-Closed]: Unclassified tool "${toolName}" is denied.`
  };
}

async function performPreflightCheck(payload) {
  const toolCall = payload && payload.toolCall;
  const localResult = evaluateLocalPolicy(toolCall, payload);

  // Local hard denials must never be overridden by the remote endpoint.
  if (localResult.decision === 'deny') return localResult;

  const preflightUrl = process.env.INFUSE_PREFLIGHT_URL;
  const apiKey = process.env.INFUSE_API_KEY;

  if (!preflightUrl || !apiKey) {
    return {
      decision: 'deny',
      reason: 'INFUSE Governance [Fail-Closed]: Remote decision endpoint and API key are required.'
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(preflightUrl);
  } catch {
    return { decision: 'deny', reason: 'INFUSE Governance [Fail-Closed]: Invalid endpoint URL.' };
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  if (
    pathname !== '/v1/tool-authorizations' ||
    (parsedUrl.protocol !== 'https:' &&
      parsedUrl.hostname !== 'localhost' &&
      parsedUrl.hostname !== '127.0.0.1')
  ) {
    return {
      decision: 'deny',
      reason: 'INFUSE Governance [Fail-Closed]: Configure the decision-only /v1/tool-authorizations endpoint over HTTPS (localhost is allowed for testing).'
    };
  }

  const name = typeof toolCall?.name === 'string' ? toolCall.name.toLowerCase() : '';
  const args = toolCall?.args || toolCall?.arguments || toolCall?.input ||
    toolCall?.parameters || {};

  let action;
  let request = {
    tool_name: name,
    request_id: typeof payload?.requestId === 'string' ? payload.requestId : undefined
  };

  if (['read_file', 'read_resource', 'list_resources'].includes(name)) {
    action = 'read';
    request.resource = args.Path || args.path || args.filePath || '';
  } else if (['write_file', 'edit_file', 'modify_file'].includes(name)) {
    action = 'write';
    request.resource = args.Path || args.path || args.filePath || '';
  } else if (['run_command', 'execute_command', 'bash'].includes(name)) {
    action = 'execute';
    request.command = args.CommandLine || args.command || args.cmd || '';
  } else {
    // Never send unknown tool types as a locally approved action.
    return {
      decision: 'deny',
      reason: `INFUSE Governance [Fail-Closed]: Unsupported tool "${name || 'missing name'}".`
    };
  }
  request.action = action;

  // Remove absent optional fields rather than sending undefined values.
  for (const key of Object.keys(request)) {
    if (request[key] === undefined) delete request[key];
  }

  try {
    const timeoutMs = Number.parseInt(process.env.INFUSE_PREFLIGHT_TIMEOUT_MS || '2000', 10);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('Invalid timeout');

    const res = await fetch(preflightUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return {
        decision: 'deny',
        reason: `INFUSE Governance [Fail-Closed]: Authorization endpoint returned HTTP ${res.status}.`
      };
    }

    const data = await res.json();
    if (
      !data || typeof data !== 'object' ||
      !['allow', 'deny', 'ask'].includes(data.decision) ||
      typeof data.reason !== 'string' || !data.reason.trim()
    ) {
      return {
        decision: 'deny',
        reason: 'INFUSE Governance [Fail-Closed]: Invalid authorization response.'
      };
    }

    // A local approval gate cannot be silently downgraded to allow.
    if (localResult.decision === 'ask' && data.decision === 'allow') {
      return {
        decision: 'ask',
        reason: 'INFUSE Governance: Local policy requires human approval.'
      };
    }

    return {
      decision: data.decision,
      reason: redactSecrets(data.reason),
      ...(data.permissionOverrides !== undefined
        ? { permissionOverrides: data.permissionOverrides } : {}),
      ...(data.overwrite !== undefined ? { overwrite: data.overwrite } : {}),
    };
  } catch {
    return {
      decision: 'deny',
      reason: 'INFUSE Governance [Fail-Closed]: Remote authorization failed or timed out.'
    };
  }
}

// Main execution function
function main() {
  let rawData = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    rawData += chunk;
  });

  process.stdin.on('end', async () => {
    try {
      if (!rawData.trim()) {
        const response = {
          decision: 'deny',
          reason: 'INFUSE Governance: Empty hook payload received on stdin (fail-closed).'
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
      }

      const payload = JSON.parse(rawData);
      const result = await performPreflightCheck(payload);
      
      // Ensure reason is redacted
      if (result.reason) {
        result.reason = redactSecrets(result.reason);
      }

      process.stdout.write(JSON.stringify(result) + '\n');
    } catch (err) {
      // Fail closed on error
      const response = {
        decision: 'deny',
        reason: `INFUSE Governance Error: Failed to parse hook payload or evaluate policy: ${err.message} (fail-closed).`
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });
}

// Export for unit testing
if (require.main === module) {
  main();
} else {
  module.exports = {
    evaluateLocalPolicy,
    evaluateToolCall: evaluateLocalPolicy,
    performPreflightCheck,
    redactSecrets,
    normalizeTargetPath,
    HARD_DENY_COMMANDS,
    PROTECTED_PATH_PATTERNS,
    ASK_COMMANDS
  };
}
