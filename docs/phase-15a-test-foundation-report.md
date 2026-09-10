# Phase 15A — Automated Testing Foundation

## Status

**Implemented in the downloaded Nexora backup.**

## Scope

This phase establishes the Vitest test structure and deterministic smoke/unit coverage for pure Nexora contracts. It intentionally does not introduce database, browser, network, or paid-AI integration tests.

## Test configuration

- Vitest 3.x was already present in the project.
- `vitest.config.ts` already existed and was extended with V8 coverage configuration.
- Tests use the existing `@` TypeScript path alias.
- Node test environment is retained because the Phase 15A suite targets server/shared pure functions and schemas.
- Test discovery is restricted to `src/tests/**/*.test.ts`.

## Tests added

- `src/tests/permissions.test.ts`
- `src/tests/safe-next.test.ts`
- `src/tests/validation.test.ts`
- `src/tests/utils.test.ts`
- `src/tests/constants.test.ts`

The suite covers permission boundaries, open-redirect-safe navigation, auth/project/task/chat validation, common utility behavior, plan limits, pricing metadata, and task nesting limits.

## Intentionally deferred

- MongoDB integration tests
- API route integration tests
- authentication/session integration tests
- AI mutation/confirmation integration tests
- browser/UI tests
- external provider/network tests

These belong to later Phase 15 sub-phases and should use isolated fixtures/mocks where appropriate.

## Dependency note

`@vitest/coverage-v8` is not present in the supplied backup and the package registry install attempt timed out in the current execution environment. The coverage configuration is therefore prepared, but coverage execution requires installing the provider dependency before `npm run test:coverage` can succeed.

No production behavior was changed to accommodate this limitation.
