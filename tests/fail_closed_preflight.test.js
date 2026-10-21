'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateLocalPolicy,
  performPreflightCheck,
} = require('../scripts/infuse-pre-tool.js');

const savedEnv = {};
const envKeys = [
  'INFUSE_PREFLIGHT_URL',
  'INFUSE_API_KEY',
  'INFUSE_PREFLIGHT_TIMEOUT_MS',
];

function setEnv(values = {}) {
  for (const key of envKeys) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

function restoreEnv() {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
    delete savedEnv[key];
  }
}

function allowedPayload() {
  return {
    toolCall: {
      name: 'read_file',
      args: { path: 'fixture.txt' },
    },
  };
}

test('unknown tools are denied by local policy', () => {
  const result = evaluateLocalPolicy({
    name: 'unrecognized_sensitive_tool',
    args: {},
  });
  assert.equal(result.decision, 'deny');
});

test('missing remote URL denies otherwise locally allowed operation', async () => {
  setEnv({ INFUSE_PREFLIGHT_URL: undefined, INFUSE_API_KEY: 'test-key' });
  try {
    const result = await performPreflightCheck(allowedPayload());
    assert.equal(result.decision, 'deny');
  } finally {
    restoreEnv();
  }
});

test('missing API key denies otherwise locally allowed operation', async () => {
  setEnv({
    INFUSE_PREFLIGHT_URL: 'https://example.invalid/v1/tool-authorizations',
    INFUSE_API_KEY: undefined,
  });
  try {
    const result = await performPreflightCheck(allowedPayload());
    assert.equal(result.decision, 'deny');
  } finally {
    restoreEnv();
  }
});

test('MCP and execution URLs are rejected as decision-only endpoints', async () => {
  for (const path of ['/mcp', '/v1/execute']) {
    setEnv({
      INFUSE_PREFLIGHT_URL: `https://example.invalid${path}`,
      INFUSE_API_KEY: 'test-key',
    });
    try {
      const result = await performPreflightCheck(allowedPayload());
      assert.equal(result.decision, 'deny', path);
    } finally {
      restoreEnv();
    }
  }
});

test('non-OK remote response fails closed', async (t) => {
  setEnv({
    INFUSE_PREFLIGHT_URL: 'https://example.invalid/v1/tool-authorizations',
    INFUSE_API_KEY: 'test-key',
  });
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });
  global.fetch = async () => ({ ok: false, status: 503 });

  const result = await performPreflightCheck(allowedPayload());
  assert.equal(result.decision, 'deny');
});

test('invalid remote decision fails closed', async (t) => {
  setEnv({
    INFUSE_PREFLIGHT_URL: 'https://example.invalid/v1/tool-authorizations',
    INFUSE_API_KEY: 'test-key',
  });
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ decision: 'maybe', reason: 'not a valid decision' }),
  });

  const result = await performPreflightCheck(allowedPayload());
  assert.equal(result.decision, 'deny');
});

test('valid remote allow, deny and ask decisions are preserved', async (t) => {
  setEnv({
    INFUSE_PREFLIGHT_URL: 'https://example.invalid/v1/tool-authorizations',
    INFUSE_API_KEY: 'test-key',
  });
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });

  for (const decision of ['allow', 'deny', 'ask']) {
    global.fetch = async (_url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      return {
        ok: true,
        json: async () => ({ decision, reason: `test ${decision}` }),
      };
    };

    const result = await performPreflightCheck(allowedPayload());
    assert.equal(result.decision, decision);
  }
});

test('network failure fails closed without leaking error details', async (t) => {
  setEnv({
    INFUSE_PREFLIGHT_URL: 'https://example.invalid/v1/tool-authorizations',
    INFUSE_API_KEY: 'test-key',
  });
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });
  global.fetch = async () => {
    throw new Error('simulated network failure with secret=DO_NOT_LEAK');
  };

  const result = await performPreflightCheck(allowedPayload());
  assert.equal(result.decision, 'deny');
  assert.equal(result.reason.includes('DO_NOT_LEAK'), false);
});
