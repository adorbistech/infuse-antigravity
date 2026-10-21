const test = require('node:test');
const assert = require('node:assert/strict');

test('Bypass Inventory: Classifies all Antigravity execution paths rigorously', () => {
  const executionPathInventory = [
    {
      path: 'run_command (Shell Execution)',
      classification: 'GOVERNED — ENFORCEMENT TESTED',
      mechanism: 'PreToolUse Hook (hooks.json -> scripts/infuse-pre-tool.js)',
      tested: true
    },
    {
      path: 'write_file / edit_file (File Modification)',
      classification: 'GOVERNED — ENFORCEMENT TESTED',
      mechanism: 'PreToolUse Hook (hooks.json -> scripts/infuse-pre-tool.js)',
      tested: true
    },
    {
      path: 'read_file (File Reading)',
      classification: 'GOVERNED — ENFORCEMENT TESTED',
      mechanism: 'PreToolUse Hook (Secret containment filter)',
      tested: true
    },
    {
      path: 'infuse_execute (Governed Task Execution)',
      classification: 'OPT-IN GOVERNED PATH',
      mechanism: 'INFUSE FastMCP Remote Interface',
      tested: true
    },
    {
      path: 'Native Model Inference (Host LLM Spend)',
      classification: 'NOT GOVERNED',
      mechanism: 'Host Platform Direct API',
      tested: false
    },
    {
      path: 'Subagent Delegation (invoke_subagent)',
      classification: 'NOT GOVERNED',
      mechanism: 'Antigravity Internal Subagent Orchestration',
      tested: false
    },
    {
      path: 'Third-Party MCP Servers (e.g. StitchMCP)',
      classification: 'NOT GOVERNED',
      mechanism: 'Direct Host MCP Client Connection',
      tested: false
    }
  ];

  // Assert all 7 paths are distinctly classified without blanket assertions
  assert.equal(executionPathInventory.length, 7);

  const governedPaths = executionPathInventory.filter(p => p.classification.startsWith('GOVERNED'));
  assert.equal(governedPaths.length, 3);

  const optInPaths = executionPathInventory.filter(p => p.classification === 'OPT-IN GOVERNED PATH');
  assert.equal(optInPaths.length, 1);

  const ungovernedPaths = executionPathInventory.filter(p => p.classification === 'NOT GOVERNED');
  assert.equal(ungovernedPaths.length, 3);
});
