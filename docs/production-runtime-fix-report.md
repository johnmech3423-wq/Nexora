# Production Runtime Fix — Radix Slot + Platform Admin Probe

## Symptoms

Authenticated non-admin users could reach login/workspace successfully, but several app routes fell into the global error boundary. Browser console showed:

- `GET /api/admin/overview 403 (Forbidden)` on normal workspace pages.
- `Slot failed to slot onto its children. Expected a single React element child or Slottable.`

## Fixes

1. Platform-admin status is now server-computed as a boolean on the authenticated `UserDTO` and consumed by `useIsPlatformAdmin()`. Normal users no longer probe the admin-only overview endpoint on every workspace page, eliminating the expected 403 request/noise.
2. The shared `Button` `asChild` implementation no longer depends on Radix `Slot`; it clones its single child directly while preserving Nexora button classes and disabled/busy semantics.
3. Global account-menu and notification triggers no longer use Radix `asChild` composition. They render the primitive trigger directly, removing two shared Slot composition points from every authenticated page.

## Notes

The application still uses Radix primitives elsewhere. Popover-based components should be regression-tested after deployment because current Radix Popover/React 19 combinations have known runtime Slot/portal issues in some environments.

No production secrets were added to source control.
