#!/usr/bin/env node
/**
 * INFUSE Post-Tool Execution Telemetry Hook
 *
 * Captures tool execution completion metadata for INFUSE telemetry
 * and outputs the required empty JSON object `{}`.
 */

function main() {
  let rawData = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    rawData += chunk;
  });

  process.stdin.on('end', () => {
    // PostToolUse contract expects an empty JSON object `{}` on stdout
    process.stdout.write('{}\n');
  });
}

if (require.main === module) {
  main();
} else {
  module.exports = { main };
}
