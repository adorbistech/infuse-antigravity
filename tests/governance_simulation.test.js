const test = require('node:test');
const assert = require('node:assert/strict');

// Simulated Governance Preflight and Budget Decision Engine
function simulateInfuseExecution(request, budgetState = { availableDollars: 100, maxSpend: 10 }) {
  if (!request || !request.taskId) {
    return {
      status: 'FAILED',
      dispatched: false,
      error: 'Malformed request: taskId required (fail-closed)'
    };
  }

  // 1. Authentication check
  if (!request.apiKey || request.apiKey !== 'valid-infuse-key') {
    return {
      status: 'DENIED',
      dispatched: false,
      reasonCode: 'AUTH_FAILED',
      error: 'Authentication failed: missing or invalid credentials'
    };
  }

  // 2. Policy check
  if (request.model && request.model.includes('unapproved')) {
    return {
      status: 'DENIED',
      dispatched: false,
      reasonCode: 'POLICY_VIOLATION',
      error: `Model "${request.model}" is not permitted by active policy`
    };
  }

  // 3. Budget preflight check
  const estimatedCost = request.estimatedCost || 1.0;
  if (estimatedCost > budgetState.availableDollars || estimatedCost > budgetState.maxSpend) {
    return {
      status: 'DENIED',
      dispatched: false,
      reasonCode: 'BUDGET_EXCEEDED',
      error: 'Preflight budget reservation failed: insufficient allocation'
    };
  }

  // 4. Governance service failure simulation
  if (request.simulateServiceFailure) {
    return {
      status: 'DENIED',
      dispatched: false,
      reasonCode: 'SERVICE_UNAVAILABLE',
      error: 'Governance service unreachable (fail-closed)'
    };
  }

  // 5. Successful reservation & execution dispatch
  return {
    status: 'COMPLETED',
    dispatched: true,
    executionId: `exec_${Date.now()}`,
    cost: estimatedCost,
    tokens: 450
  };
}

test('Governance Simulation: Missing or invalid authentication fails closed with zero dispatch', () => {
  const reqNoAuth = { taskId: 'task-1', estimatedCost: 0.5 };
  const resNoAuth = simulateInfuseExecution(reqNoAuth);
  assert.equal(resNoAuth.status, 'DENIED');
  assert.equal(resNoAuth.dispatched, false);
  assert.equal(resNoAuth.reasonCode, 'AUTH_FAILED');

  const reqBadAuth = { taskId: 'task-2', apiKey: 'invalid-key', estimatedCost: 0.5 };
  const resBadAuth = simulateInfuseExecution(reqBadAuth);
  assert.equal(resBadAuth.status, 'DENIED');
  assert.equal(resBadAuth.dispatched, false);
  assert.equal(resBadAuth.reasonCode, 'AUTH_FAILED');
});

test('Governance Simulation: Policy denial results in zero provider dispatch', () => {
  const reqBadModel = {
    taskId: 'task-3',
    apiKey: 'valid-infuse-key',
    model: 'unapproved-gpt-5',
    estimatedCost: 1.0
  };
  const resBadModel = simulateInfuseExecution(reqBadModel);
  assert.equal(resBadModel.status, 'DENIED');
  assert.equal(resBadModel.dispatched, false);
  assert.equal(resBadModel.reasonCode, 'POLICY_VIOLATION');
});

test('Governance Simulation: Budget preflight denial results in zero provider dispatch', () => {
  const reqOverBudget = {
    taskId: 'task-4',
    apiKey: 'valid-infuse-key',
    model: 'claude-3-5-sonnet',
    estimatedCost: 50.0 // Exceeds maxSpend 10.0
  };
  const budget = { availableDollars: 100.0, maxSpend: 10.0 };
  const resOverBudget = simulateInfuseExecution(reqOverBudget, budget);
  assert.equal(resOverBudget.status, 'DENIED');
  assert.equal(resOverBudget.dispatched, false);
  assert.equal(resOverBudget.reasonCode, 'BUDGET_EXCEEDED');
});

test('Governance Simulation: Service failure fails closed with zero provider dispatch', () => {
  const reqServiceFail = {
    taskId: 'task-5',
    apiKey: 'valid-infuse-key',
    simulateServiceFailure: true
  };
  const resServiceFail = simulateInfuseExecution(reqServiceFail);
  assert.equal(resServiceFail.status, 'DENIED');
  assert.equal(resServiceFail.dispatched, false);
  assert.equal(resServiceFail.reasonCode, 'SERVICE_UNAVAILABLE');
});

test('Governance Simulation: Valid request passes preflight and dispatches successfully', () => {
  const reqValid = {
    taskId: 'task-6',
    apiKey: 'valid-infuse-key',
    model: 'claude-3-5-sonnet',
    estimatedCost: 0.05
  };
  const resValid = simulateInfuseExecution(reqValid);
  assert.equal(resValid.status, 'COMPLETED');
  assert.equal(resValid.dispatched, true);
  assert.ok(resValid.executionId);
});
