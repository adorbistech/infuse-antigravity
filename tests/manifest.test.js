const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

test('Manifest & Discovery: plugin.json is valid and complete', () => {
  const pluginPath = path.join(ROOT_DIR, 'plugin.json');
  assert.ok(fs.existsSync(pluginPath), 'plugin.json must exist');

  const content = fs.readFileSync(pluginPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.name, 'infuse-antigravity');
  assert.equal(manifest.version, '0.1.0');
  assert.ok(manifest.description, 'manifest must have description');
  assert.ok(Array.isArray(manifest.mcpServers), 'mcpServers must be an array');
  assert.ok(manifest.hooks, 'hooks path must be defined');
  assert.ok(Array.isArray(manifest.skills), 'skills must be an array');
  assert.ok(Array.isArray(manifest.rules), 'rules must be an array');
});

test('Manifest & Discovery: referenced files exist on disk', () => {
  const pluginPath = path.join(ROOT_DIR, 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));

  // Check mcp_config.json
  manifest.mcpServers.forEach((relPath) => {
    const fullPath = path.resolve(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(fullPath), `mcpServer config must exist: ${relPath}`);
  });

  // Check hooks.json
  const hooksPath = path.resolve(ROOT_DIR, manifest.hooks);
  assert.ok(fs.existsSync(hooksPath), 'hooks.json must exist');

  // Check skills
  manifest.skills.forEach((skillRel) => {
    const skillPath = path.resolve(ROOT_DIR, skillRel, 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), `SKILL.md must exist in ${skillRel}`);
  });

  // Check rules
  manifest.rules.forEach((ruleRel) => {
    const rulePath = path.resolve(ROOT_DIR, ruleRel);
    assert.ok(fs.existsSync(rulePath), `Rule file must exist: ${ruleRel}`);
  });
});

test('Manifest & Discovery: hooks.json adheres to Antigravity schema', () => {
  const hooksPath = path.join(ROOT_DIR, 'hooks.json');
  assert.ok(fs.existsSync(hooksPath), 'hooks.json must exist');

  const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
  assert.ok(hooks['infuse-governance'], 'infuse-governance hook definition required');

  const govHook = hooks['infuse-governance'];
  assert.equal(govHook.enabled, true);
  assert.ok(Array.isArray(govHook.PreToolUse), 'PreToolUse handlers must be an array');
  assert.ok(Array.isArray(govHook.PostToolUse), 'PostToolUse handlers must be an array');

  // Verify scripts exist
  govHook.PreToolUse.forEach((group) => {
    assert.ok(group.matcher, 'matcher regex required');
    group.hooks.forEach((h) => {
      assert.equal(h.type, 'command');
      assert.ok(h.command, 'command string required');
      const scriptPath = h.command.split(' ').pop();
      assert.ok(fs.existsSync(path.resolve(ROOT_DIR, scriptPath)), `Hook script must exist: ${scriptPath}`);
    });
  });
});
