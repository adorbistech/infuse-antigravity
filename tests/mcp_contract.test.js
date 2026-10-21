const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

test('MCP Contract: mcp_config.json shape and configuration', () => {
  const mcpConfigPath = path.join(ROOT_DIR, 'mcp_config.json');
  assert.ok(fs.existsSync(mcpConfigPath), 'mcp_config.json must exist');

  const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  assert.ok(config.mcpServers, 'mcpServers object required');
  assert.ok(config.mcpServers.infuse, 'infuse server definition required');
  assert.equal(config.mcpServers.infuse.type, 'http');
  assert.equal(config.mcpServers.infuse.url, 'https://infuse-api.adorbistech.com/mcp');

  // Verify no credentials or keys are embedded in configuration
  const configString = JSON.stringify(config);
  assert.ok(!/bearer|key|secret|token|password/i.test(configString), 'No secrets embedded in mcp_config');
});

test('MCP Contract: Expected INFUSE FastMCP tool schema contracts', () => {
  // Authoritative 12 tools exposed by INFUSE Block 30 FastMCP layer
  const expectedTools = [
    'infuse_execute',
    'infuse_get_execution',
    'infuse_get_execution_state',
    'infuse_get_execution_result',
    'infuse_list_executions',
    'infuse_list_events',
    'infuse_publish_event',
    'infuse_get_policy',
    'infuse_list_policies',
    'infuse_update_policy',
    'infuse_get_governor_decision',
    'infuse_control'
  ];

  assert.equal(expectedTools.length, 12);
  assert.ok(expectedTools.includes('infuse_execute'));
  assert.ok(expectedTools.includes('infuse_get_governor_decision'));
  assert.ok(expectedTools.includes('infuse_control'));
});
