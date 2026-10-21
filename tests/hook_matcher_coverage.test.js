const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PreToolUse matcher covers all remotely mapped tool aliases', () => {
  const config = JSON.parse(fs.readFileSync('hooks.json', 'utf8'));
  const groups = config['infuse-governance'].PreToolUse;
  const matcher = groups.map(group => group.matcher).join('|');

  const coveredTools = [
    'run_command',
    'execute_command',
    'bash',
    'write_file',
    'edit_file',
    'modify_file',
    'read_file',
    'read_resource',
    'list_resources',
  ];

  for (const tool of coveredTools) {
    assert.match(
      tool,
      new RegExp(`^(?:${matcher})$`),
      `PreToolUse matcher does not cover ${tool}`
    );
  }
});
