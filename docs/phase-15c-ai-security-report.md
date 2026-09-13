# Phase 15C — AI Security & Mutation Tests

## Scope

This phase hardens the AI mutation boundary and adds automated tests around the proposal parser and mutation argument validation.

## Verified in source

- AI mutation tools are limited to `create_task`, `create_subtasks`, and `update_task`.
- Tool arguments are validated with Zod before a proposal is persisted.
- Proposal validation re-checks organization/project ownership and project permissions.
- Task parent/depth checks reuse the canonical `taskDepth` / `TASK_MAX_DEPTH` implementation.
- Initial AI chat creates pending actions only; it does not execute mutations.
- Pending actions are persisted with organization and user ownership plus a 10-minute expiry.
- Confirmation executes only server-stored validated arguments; client-supplied arguments are ignored.
- Confirmation uses an atomic `pending -> executing` claim to block double execution.
- Rejection is also atomic and does not execute a tool.
- Confirm/reject/chat routes have explicit rate limits.
- Provider `none` produces no mutation proposals.

## Automated tests added

`src/tests/ai-mutation-safety.test.ts` covers:

1. Allowlisted tool parsing.
2. Malformed/unknown tool rejection.
3. Five-call parser bound.
4. Strict schemas for all three mutation tools.
5. Stripping/ignoring unexpected schema fields.

## Existing regression test correction

The project defines 25 project permission keys, not 26. The existing permission test was corrected to assert 25 manager permissions.

## Environment limitation

The current working environment does not contain `node_modules`, and package installation previously timed out because external package downloads were unavailable. Therefore the Vitest suite could not be executed in this environment. This is an environment limitation, not a claimed production test failure.

Coverage reporting remains configured through Vitest/V8, but `@vitest/coverage-v8` is not yet present in `package.json` because installation was unavailable. It should be added and the lockfile refreshed in a networked CI/deployment environment before relying on `npm run test:coverage`.

## Status

**Phase 15C source/test hardening: COMPLETE.**

Runtime test execution: **BLOCKED BY MISSING DEPENDENCIES IN CURRENT ENVIRONMENT.**
