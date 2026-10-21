'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const HOOK_SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'infuse-pre-tool.js');

function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/v1/tool-authorizations`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

function invokeHookProcess(payload, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_SCRIPT_PATH], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      try {
        const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : null;
        resolve({ code, stdout: parsed, rawStdout: stdout, stderr });
      } catch (err) {
        reject(new Error(`Failed to parse hook stdout "${stdout}": ${err.message}`));
      }
    });

    proc.on('error', reject);

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

test('Runtime Activation E2E: Hook subprocess allows valid request against local decision endpoint', async () => {
  let receivedRequest = null;
  let receivedAuthHeader = null;

  const mock = await createMockServer(async (req, res) => {
    receivedAuthHeader = req.headers['authorization'];
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      receivedRequest = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ decision: 'allow', reason: 'Mock server: workspace read authorized' }));
    });
  });

  try {
    const inputPayload = {
      conversationId: 'test-conv-123',
      stepIdx: 1,
      toolCall: {
        name: 'read_file',
        args: { Path: 'docs/README.md' },
      },
    };

    const result = await invokeHookProcess(inputPayload, {
      INFUSE_PREFLIGHT_URL: mock.url,
      INFUSE_API_KEY: 'test-runtime-secret-key',
    });

    assert.equal(result.code, 0);
    assert.ok(result.stdout);
    assert.equal(result.stdout.decision, 'allow');
    assert.match(result.stdout.reason, /workspace read authorized/);

    assert.equal(receivedAuthHeader, 'Bearer test-runtime-secret-key');
    assert.equal(receivedRequest.tool_name, 'read_file');
    assert.equal(receivedRequest.action, 'read');
    assert.equal(receivedRequest.resource, 'docs/README.md');
  } finally {
    await mock.close();
  }
});

test('Runtime Activation E2E: Hook subprocess enforces remote denial', async () => {
  const mock = await createMockServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ decision: 'deny', reason: 'Mock server: policy block on unapproved file' }));
    });
  });

  try {
    const inputPayload = {
      toolCall: {
        name: 'write_file',
        args: { Path: 'src/calculator.ts', Content: '// new code' },
      },
    };

    const result = await invokeHookProcess(inputPayload, {
      INFUSE_PREFLIGHT_URL: mock.url,
      INFUSE_API_KEY: 'test-runtime-secret-key',
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout.decision, 'deny');
    assert.match(result.stdout.reason, /policy block/);
  } finally {
    await mock.close();
  }
});

test('Runtime Activation E2E: Hook subprocess fails closed on mock server failure or network error', async () => {
  const mock = await createMockServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  });

  try {
    const inputPayload = {
      toolCall: {
        name: 'read_file',
        args: { Path: 'README.md' },
      },
    };

    const result = await invokeHookProcess(inputPayload, {
      INFUSE_PREFLIGHT_URL: mock.url,
      INFUSE_API_KEY: 'test-runtime-secret-key',
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout.decision, 'deny');
    assert.match(result.stdout.reason, /Fail-Closed/);
  } finally {
    await mock.close();
  }
});

test('Runtime Activation E2E: Local hard-deny intercepts destructive command before contacting network', async () => {
  let serverContacted = false;

  const mock = await createMockServer((req, res) => {
    serverContacted = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ decision: 'allow', reason: 'Rogue allow' }));
  });

  try {
    const inputPayload = {
      toolCall: {
        name: 'run_command',
        args: { CommandLine: 'rm -rf /' },
      },
    };

    const result = await invokeHookProcess(inputPayload, {
      INFUSE_PREFLIGHT_URL: mock.url,
      INFUSE_API_KEY: 'test-runtime-secret-key',
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout.decision, 'deny');
    assert.match(result.stdout.reason, /destructive or history-altering/);
    assert.equal(serverContacted, false, 'Local hard denial must never contact remote server');
  } finally {
    await mock.close();
  }
});
