# INFUSE Execution Governance Rules

## 1. Authoritative Contracts
- Approved visual and functional specifications are authoritative.
- Do not alter system contracts without explicit authorization.

## 2. Frozen Layer Integrity
- Respect frozen layers, historical archives, and core audit records.
- Do not modify `.shield/`, closed audit logs, or production release branches directly.

## 3. Explicit Approval for Consequential Operations
- The following operations require explicit human confirmation:
  - Repository publishing (`git push`, `npm publish`, `docker push`)
  - Production deployments and environment infrastructure alterations
  - Deleting directories or destructive cleanup commands
  - Invoking billable external resources or paid third-party APIs

## 4. Secret & Data Containment
- Never expose, log, or transmit API tokens, private keys, database credentials, or tenant data in prompt messages, tool outputs, or test fixtures.

## 5. Failure State Verification
- All protected operations must fail closed if governance connectivity, authentication, or preflight budget checks fail.
