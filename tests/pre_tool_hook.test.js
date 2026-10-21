const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  evaluateToolCall,
  redactSecrets,
  normalizeTargetPath,
} = require('../scripts/infuse-pre-tool.js');

test('PreToolHook: Allowed read-only command passes policy check', () => {
  const payload = {
    name: 'run_command',
    args: { CommandLine: 'npm test' }
  };
  const result = evaluateToolCall(payload);
  assert.equal(result.decision, 'allow');
  assert.match(result.reason, /verified against security policies/i);
});

test('PreToolHook: Destructive commands are hard-denied (Zero execution)', () => {
  const dangerousCommands = [
    'rm -rf /',
    'rm -rf ~/',
    'mkfs.ext4 /dev/sda1',
    ':(){ :|:& };:',
    'git reset --hard HEAD~1',
    'git clean -fdx',
    'git push origin main --force',
    'echo "starting" && git reset --hard HEAD~1',
    'build.sh; rm -rf /'
  ];

  for (const cmd of dangerousCommands) {
    const payload = {
      name: 'run_command',
      args: { CommandLine: cmd }
    };
    const result = evaluateToolCall(payload);
    assert.equal(result.decision, 'deny', `Command should be denied: ${cmd}`);
    assert.match(result.reason, /destructive or history-altering operation detected/i);
  }
});

test('PreToolHook: Consequential deployment/publication commands require approval (ask)', () => {
  const gatedCommands = [
    'git push origin main',
    'npm publish',
    'pip upload dist/*',
    'docker push myrepo/app:latest',
    'terraform apply -auto-approve',
    'npm run build && git push origin feat/test'
  ];

  for (const cmd of gatedCommands) {
    const payload = {
      name: 'run_command',
      args: { CommandLine: cmd }
    };
    const result = evaluateToolCall(payload);
    assert.equal(result.decision, 'ask', `Command should require approval: ${cmd}`);
    assert.match(result.reason, /Approval Gate/i);
  }
});

test('PreToolHook: Modification of frozen layers and production env is blocked', () => {
  const blockedPaths = [
    '.env.production',
    '.env.local',
    '.shield/archives/ARCHIVE_2026-10-21.md',
    '/Users/ssd/project/id_rsa',
    'subdir/../.env.production',
    './.env.production',
    'deep/nested/path/../../.shield/archives/test.md'
  ];

  for (const p of blockedPaths) {
    const payload = {
      name: 'write_file',
      args: { Path: p, Content: 'test' }
    };
    const result = evaluateToolCall(payload);
    assert.equal(result.decision, 'deny', `Path modification should be denied: ${p}`);
    assert.match(result.reason, /Frozen Layer/i);
  }
});

test('PreToolHook: Safe file modification is allowed', () => {
  const payload = {
    name: 'write_file',
    args: { Path: '/Users/ssd/infuse-antigravity/src/calculator.ts', Content: '// updated' }
  };
  const result = evaluateToolCall(payload);
  assert.equal(result.decision, 'allow');
});

test('PreToolHook: Reading private credential path is blocked', () => {
  const payload = {
    name: 'read_file',
    args: { Path: '/Users/ssd/.ssh/id_rsa' }
  };
  const result = evaluateToolCall(payload);
  assert.equal(result.decision, 'deny');
  assert.match(result.reason, /Secret Containment/i);
});

test('PreToolHook: Secret redaction sanitizes tokens from reason output', () => {
  const rawCmd = 'curl -H "Authorization: Bearer sk-secret1234567890abcdef" https://api.example.com';
  const redacted = redactSecrets(rawCmd);
  assert.ok(!redacted.includes('sk-secret1234567890abcdef'), 'Secret token must not appear in output');
  assert.ok(redacted.includes('[REDACTED]'), 'Secret token must be replaced by [REDACTED]');
});

test('PreToolHook: Malformed payload fails closed', () => {
  const resultNull = evaluateToolCall(null);
  assert.equal(resultNull.decision, 'deny');
  assert.match(resultNull.reason, /fail-closed/i);

  const resultEmptyCmd = evaluateToolCall({ name: 'run_command', args: { CommandLine: '' } });
  assert.equal(resultEmptyCmd.decision, 'deny');
  assert.match(resultEmptyCmd.reason, /fail-closed/i);

  const resultEmptyPath = evaluateToolCall({ name: 'write_file', args: { Path: '' } });
  assert.equal(resultEmptyPath.decision, 'deny');
  assert.match(resultEmptyPath.reason, /fail-closed/i);
});
