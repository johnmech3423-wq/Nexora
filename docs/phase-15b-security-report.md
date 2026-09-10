# Nexora — Phase 15B Security & Tenant-Isolation Tests

## Scope
Automated tests for authentication/security primitives and authorization boundaries. No production business logic was intentionally changed.

## Added tests
- `src/tests/security-primitives.test.ts`
  - token generation/hashing
  - constant-time token comparison behavior
  - AES-GCM encryption/decryption and tamper detection
  - signed payload validity, expiry and tamper rejection
  - TOTP generation/verification
  - password hashing/verification
- `src/tests/authorization-guard.test.ts`
  - org permission enforcement
  - owner-only billing permission
  - project admin access
  - suspended membership rejection
  - viewer read-vs-write boundary
  - archived-project mutation blocking

## Intentionally not covered in 15B
- live MongoDB integration
- HTTP route integration
- browser/E2E tests
- AI mutation workflows (Phase 15C)
- full service regression (Phase 15D)

## Verification
The environment may not have all npm registry dependencies available. Do not claim the Vitest suite is green unless `npm ci` and `npm run test:run` complete successfully in a networked environment.
