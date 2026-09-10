# Module 12 — Platform Admin Console · Completion Report

**Date:** 2026-09-09 · **Status:** Complete — all gates green
**Scope:** Production-grade platform-admin console (`/admin`), built exclusively on the existing platform-admin API. **No backend changes.** Frozen Modules 1–11 behavior untouched; the only non-UI workspace change is one QA env line (see §12).

---

## 1. Architecture decision (verified against the real app)

The project's route tree is: root `app/layout.tsx` → route groups `(app)` (authenticated shell) / `(marketing)` / `(auth)` etc. A top-level `/admin` segment was added directly under the **root layout**, so it shares Providers/theme/Toaster but **never** inherits the `(app)` sidebar shell, org gates, or marketing chrome. Verified end-to-end: `next build` lists `/admin`, `/admin/users`, `/admin/organizations` as static prerenders and the dev server serves them 200 with live SSR API calls — no structural conflict.

Gate model (all client-side orchestration over **real, server-protected endpoints** — UI hiding never replaces server authorization):

1. `useMe()` session check → anonymous/expired sessions are redirected to the standard safe `/login?next=<path>` flow (verified in-browser).
2. `GET /api/admin/overview` probe (cached 5 min) → **403** is now distinguished from transport/5xx errors and renders the explicit **“Restricted area”** state with “Back to the app” / “Sign in with another account” actions; genuine outages render a “Couldn't verify admin access → Try again” state. (403 handling was corrected during browser QA — see §11.)
3. Authorized → dedicated control-plane shell + page content.

## 2. Routes and files (all new this module)

| Route | File | Notes |
|---|---|---|
| `/admin` | `src/app/admin/layout.tsx` | `title: "Platform Admin"` metadata, `robots: noindex,nofollow` (verified in SSR HTML; fixes the double brand suffix `· Nexora · Nexora` seen in early HTML checks) |
| `/admin` | `src/app/admin/page.tsx` | Overview: real `/api/admin/overview` stats via React Query (no polling, no invented metrics) |
| `/admin/users` | `src/app/admin/users/page.tsx` | Users list (see §4) |
| `/admin/organizations` | `src/app/admin/organizations/page.tsx` | Organizations list (see §5) |
| shared | `src/components/admin/admin-shell.tsx` | Dedicated admin shell: brand + “Platform Admin” badge, Overview/Users/Organizations nav, theme switcher (Light/Dark/System), account menu (identity, Back to the app, Sign out), gate/splash/forbidden/probe-error states |
| shared | `src/components/admin/list-state.ts` | `useAdminListState()` URL-state hook + `adminListQueryKey()`; `ADMIN_PAGE_SIZE_OPTIONS = [25, 50, 100]` |
| shared | `src/components/admin/admin-actions.tsx` | `UserRowActions` (suspend/reactivate confirm dialogs) + `OrgPlanAction` (plan-change dialog) + `describeError` |
| shared | `src/lib/admin-api.ts` | Typed fetch helpers (`AdminOverview`, `AdminUserRow`, `AdminOrgRow`, `AdminPageResult<T>`, `ADMIN_PAGE_SIZE_MAX = 100`) |
| — | `.env` | `ADMIN_EMAILS=m9c@nexora.dev` appended for local QA (server-side allowlist; read at server start) |

## 3. Endpoints consumed (all pre-existing, all verified live)

| Endpoint | Method | Used for |
|---|---|---|
| `/api/admin/overview` | GET | Access probe + overview stats |
| `/api/admin/users?q=&page=&pageSize=` | GET | Users list (server `total` drives pagination) |
| `/api/admin/users/[userId]` | PATCH `{suspended}` | Suspend / reactivate |
| `/api/admin/organizations?q=&page=&pageSize=` | GET | Organizations list |
| `/api/admin/organizations/[orgId]` | PATCH `{plan}` | Plan change (`free`/`pro`/`business` only) |
| `/api/auth/me`, `/api/auth/logout` | GET/POST | Session + sign-out |

No filters, detail pages, or stats beyond what these endpoints return were invented. URL state is committed **only** for backend-understood parameters (`q`, `page`, `pageSize`) — clean URLs omit defaults, `pageSize` is capped client-side at the API max, search commits after a 400 ms debounce and resets to page 1, page-size changes also reset to page 1.

## 4. Users page

- Table: avatar+name/email, **Active/Suspended** status, email-verified badge, organizations count (right-aligned), last login (“Never” or date), created date.
- **Suspend / Reactivate** via `ConfirmDialog` pairs with copy that matches backend semantics exactly: suspension revokes the user's sessions **and** suspends their org memberships; reactivation restores memberships to `active` but **does not restore revoked sessions**.
- Self-row renders a muted **“You (admin)”** badge instead of destructive controls (the server additionally rejects self-suspend with 400 — verified).
- Skeletons while loading (`PageFallback`), empty state, error state with retry; real search + per-page select + pagination; wrapped in `<React.Suspense>` (pages read `useSearchParams`).

## 5. Organizations page

- Table: name + slug (`<code>` chip), **plan badge** (Free/Pro/Business with `· $X/mo` from the shared `PLANS`/`PLAN_PRICING` catalog — same source the server enforces), member count (right-aligned), created date.
- **Change plan** opens a dialog with radio choices limited to `free | pro | business` (labels + pricing taglines) and a “No change” disabled Apply button; success/failure toasts; invalidates list queries by prefix key (`["admin","list",…]`) and refetches.
- Honesty footer: member counts come from the platform service; workspace owners manage their own billing under **Settings → Billing**.

## 6. Mutation UX conventions (shared)

Every action: busy spinner in the confirm button, duplicate-submit guard, `describeError()` maps `ApiClientError` to concise copy (never raw error blobs), success toast, then `queryClient.invalidateQueries({ queryKey: ["admin", "list", kind] })` + refetch. `ConfirmDialogContent` renders `title`/`description`/`confirmLabel`/spinner (children not rendered) — user/org context is carried in `description`.

## 7. Live API verification (real server, real Mongo)

Full matrix exercised and reverted with disposable fixtures (orgs “M12 QA Plan”, “M12 QA Plan 2” — since deleted via the real DELETE route):

- Suspend PATCH 200 → target's existing session cookie immediately 401; memberships flip `active → suspended` (verified at DB level) → reactivate PATCH 200 → memberships `active`, sessions stay revoked; target account never suspends its own session. UI copy reflects this exactly.
- Self-suspend → 400 `validation_error` “You cannot suspend your own admin account.”; non-admin PATCH → 403 “Platform admin access is restricted.”; anon → 401; bogus ObjectId → 404.
- Org plan free→pro→business→free all 200, reflected in the admin list; non-admin → 403; anon → 401.
- Anon `/api/admin/overview` → 401; non-admin (m9a) → 403. **No allowlist email ever appears in any error body.**

## 8. Browser QA (headless Chromium, real sessions)

Playwright was installed **temporarily** for QA (then uninstalled — `package.json`/`package-lock.json` reverted, no new dependency) and 21/21 checks passed on the final build:

- **A** anon `/admin` → `/login?next=%2Fadmin`, no admin content pre-leaked in the shell HTML.
- **B/C/D** m9c (allowlisted): shell + nav render; overview stats present; 13 user rows with badges; search narrows to the query; orgs show plans and per-row “Change plan” affordances; Dark theme applies to `<html>` and back to Light; account menu contains Back to the app and Sign out.
- **E** Sign-out POSTs logout, clears the cookie, and lands on `/login`.
- **F** m9a (authenticated, not allowlisted): stays on `/admin/users` (no redirect loop), sees the **Restricted area** state, admin nav hidden, Back-to-the-app anchor offered.
- Console clean apart from *intentional* guard responses (anon 401, non-admin 403) and one pre-existing Next smooth-scroll dev warning. No React hydration errors, zero “Switched to client rendering” fallbacks on any admin route.

Screenshots: `docs/module-12/m12-overview.png`, `m12-users.png`, `m12-orgs-dark.png`, `m12-forbidden.png` (DOM-level assertions above were the authoritative checks).

## 9. Security audit

- **SSR HTML (anon + authed):** no admin data, no user emails, no env sigils, no allowlist values, no long tokens. The only email-like strings in HTML with a `?q=…` URL are the RSC serialization of the user's own typed query — self-echo, not a leak.
- **Client bundles:** scanned all 18 JS chunks served for `/admin/users` — the sole email match is the clsx MIT license header; the only “allowlist” occurrence is an admin-shell code comment. No `ADMIN_EMAILS`, env names, or secrets in any bundle.
- No `dangerouslySetInnerHTML` anywhere in admin code; all interpolations (including the search query) render through React escaping.
- The allowlist itself stays server-only (`src/server/…/requirePlatformAdmin`); the console never reveals whether an arbitrary email is an admin — 403 copy is deliberately generic.
- Admin pages are `noindex` + client data never pre-rendered into static HTML (data arrives only after the gate passes).

## 10. Regression (Modules 1–11, final sweep against the running dev server)

All **200**: `/`, `/features`, `/pricing`, `/about`, `/security`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding` (anon); `/dashboard`, `/projects`, `/calendar`, `/chat`, `/tasks`, `/time`, `/notifications`, `/files`, `/settings/{general,profile,security,members,billing,webhooks,api}` (authenticated); admin routes with real `?q=`/`?page=` params (authorized). No frozen files or backend files were modified this module; server log clean of SSR/render errors through the sweep.

## 11. Validation gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint .` | **0 errors, 74 warnings — unchanged pre-module baseline** |
| `npx next build` | **Compiled successfully** — `/admin`, `/admin/users`, `/admin/organizations` static prerenders; `/api/admin/*` dynamic |
| SSR/HTML | All admin routes 200; anon shell contains no admin UI/emails/tokens; `robots noindex`; titles correct |
| Browser E2E | 21/21 checks green, including 403→Restricted-area and dark-theme round-trips |
| Security scans | HTML + bundles free of secrets/env/allowlist/user emails (see §9) |
| Live API matrix | Mutations, guards, self-suspend 400, revocations, plan limits — all match backend semantics (§7) |

QA fixes made *during* this module's final pass: (1) admin layout title template no longer duplicates the brand suffix; (2) the shell now routes an authenticated 403 probe to the explicit Restricted-area state instead of a generic “couldn't verify” error with retry.

## 12. QA residue & honest limitations

- **QA admin identity:** `ADMIN_EMAILS` in `.env` contains `m9c@nexora.dev` (the module's QA admin). Because the browser sign-out test destroys that session each run, its password was reset during QA through the real forgot/reset email flow (outbox) to `M12AdminP@ss2026!` — a documented, reversible QA action. Allowlist changes require a dev-server restart (env read at boot).
- **Soft-deleted QA orgs** (“M12 QA Plan”, “M12 QA Plan 2”) remain as `deletedAt`-flagged documents plus their membership rows — identical residue to every earlier module's deleted QA orgs; this platform deletes orgs softly, and manual DB surgery was deliberately avoided.
- The pre-existing module-10 QA account `m10fresh-…@nexora.dev` (suspend/reactivate target) remains an ordinary user; there is no admin delete-user API, so it was restored to `active` with no memberships.
- No polling/realtime anywhere; overview stats are a single fetch of what the backend reports.
- Static prerender + client-side gate means an anonymous curl receives the 200 shell HTML; the actual redirect to `/login?next=` happens client-side after `/api/auth/me` resolves — the established pattern for authenticated areas of this app, verified in-browser (§8A).
- Visual review was DOM-assertion-based (headless Chromium); screenshots are provided for human inspection but were not pixel-reviewed.

## 13. Bottom line

Module 12 ships the console **exactly** against the real platform-admin backend: users list with confirm-guarded suspend/reactivate, organizations list with plan-change dialog limited to `free|pro|business`, real `total` pagination, URL state limited to backend-understood parameters, dedicated admin shell/branding/theme/back-to-app/sign-out, correct platform-admin vs org-admin boundary at every layer, and clean security posture. All gates green; Modules 1–11 regression clean; **No backend changes.**
