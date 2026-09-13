# Module 10 — Production Authentication UI · Completion Report

**Date:** 2026-09-09 · **Status:** Complete — all gates green
**Scope:** New public auth route group `src/app/(auth)` + shared client auth kit. No backend changes. Frozen modules untouched.

---

## 1. Implemented pages & components

| Artifact | Route | Notes |
|---|---|---|
| `src/app/(auth)/layout.tsx` | — | Branded centered shell (logo, tagline), light/dark, responsive |
| `src/app/(auth)/login/page.tsx` | `/login` | Credentials step + in-page **2FA challenge step** (no separate `/2fa` route — none exists server-side); keep-me-signed-in (30d vs 7d); forgot link; register switch |
| `src/app/(auth)/register/page.tsx` | `/register` | Name/email/password/confirm, live password-rule checklist, schema-mirroring validation (2–80 name, ≤254 email, 8–72 pw letter+digit) |
| `src/app/(auth)/forgot-password/page.tsx` | `/forgot-password` | Generic anti-enumeration success state; rate-limit hint; signed-in users get a "change in settings" link |
| `src/app/(auth)/reset-password/page.tsx` | `/reset-password?token=…` | Token required states, 30-min/one-use copy, token stripped from the address bar, all-sessions-revoked success state |
| `src/app/(auth)/verify-email/page.tsx` | `/verify-email?token=…` | Auto-verify on load, expired/invalid state, resend (3/h copy) for signed-in unverified users, already-verified state via `/api/auth/me` |
| `src/components/auth/auth-ui.tsx` | shared | `AuthCard`, `AuthAlert`, `RateLimitHint`, `PasswordField` (visibility toggle), `FieldError`, `goAfterAuth`, `AuthSubmitButton` |
| `src/lib/safe-next.ts` | helper | Open-redirect-safe destination resolution (hardened this module: also rejects CR/LF in decoded form) |

**Design decision:** forms use controlled state + validation mirroring `src/validations/auth.schema.ts` rather than RHF — same contract, zero effect-driven state (the React-compiler lint class of bugs that hit Modules 8–9). No second auth system was introduced.

## 2. Integrated APIs (all pre-existing, none invented)

`POST /api/auth/login`, `POST /api/auth/two-factor/verify`, `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me` (session bounce + verified state), `GET /api/organizations` (post-auth destination). `/logout` continues to be handled by the existing app user-menu.

## 3. Security behavior (verified)

- **`safeNext` everywhere**: post-login destination, authenticated-visitor bounce, login⇄register cross-links. 16-case unit run **all pass** (rejects `//host`, `/\host`, `/%5c%5cevil`, `/%2f%2f`, encoded CR/LF, external schemes; keeps queries like `/settings/billing?org=…`). SSR link-scrape confirms hostile `?next=` values produce a plain `/register` or `/login` — never an off-site href.
- **`skipAuthRedirect: true`** on every auth-page fetch so `apiFetch`'s auto-401 redirect never fights the login view.
- **Authenticated visitors bounce** from login/register (checked via `/api/auth/me`); reset page **strips the token from the URL** after load; tokens appear only in Next's internal RSC payload, never in visible HTML links.
- **2FA error triage**: 400/422 (dead/malformed challenge) → back to credentials; 401 (wrong code) → stay on the 2FA step; 429 → inline rate-limit hint. Mirrors `auth.service.ts` semantics exactly.
- **Anti-enumeration copy honored**: forgot-password always shows the generic sent state; register UI never infers verification from the hardcoded `emailVerified:false` response field (users are actually auto-verified in this env — `/api/auth/me` reports true).

## 4. Live verification results

| Check | Result |
|---|---|
| SSR anon, all 5 routes (+`?token=`, `?next=` variants, 8 requests) | **200, 0 client-render fallbacks** (after fixing a `Slot asChild`+`Link` SSR failure — same class as Module 9's; fixed with `buttonVariants` anchors, module-9 precedent) |
| Full register flow via real API | 200 `{registered:true}`, session cookie set; user auto-verified |
| Duplicate register | 409 `An account with this email already exists.` |
| Forgot-password (existing + nonexistent) | both 200 `{sent:true}`; reset email outbox link → `reset-password?token=…` |
| Reset-password with outbox token | 200 `{reset:true}`; **old sessions revoked** (401); **token single-use** (400) |
| Login correct creds | 200 `{needsTwoFactor:false}`, session works |
| Login wrong password | 401 `Incorrect email or password.` |
| **2FA full lifecycle** (QA user m9c): provision → enable with RFC-6238 TOTP (stdlib-generated) → login returns `needsTwoFactor:true` + challenge → wrong code 401 `That code is incorrect or expired.` → correct code 200 `{verified:true}` + session → disabled again (state restored) | **pass** |
| Login 429 rate limit (11th wrong attempt) | 429 `rate_limited` `Too many sign-in attempts. Try again in a few minutes.` — matches page regex mapping |
| Bad verify token | 400 `This verification link is invalid or has expired. Request a new one.` |
| Frozen modules w/ sessions (billing/webhooks/api/onboarding/dashboard under fixture + zero-org users) | all 200 |
| `safeNext` unit matrix | 16/16 pass |

## 5. Gates

- `npx tsc --noEmit` — **clean**
- `npx eslint .` — **0 errors** (74 pre-existing warnings, unchanged baseline)
- `npx next build` — **compiled successfully, 63/63 pages** (auth routes static)

## 6. Remaining issues / notes

- Backend `[activity] failed to persist log: organizationId required` noise on auth logins (org-less activity) — pre-existing backend behavior, out of scope (no backend changes allowed).
- Challenge replay within TTL succeeds server-side (backend semantics; left untouched).
- QA fixtures state: m9c password is now `QaPassw0rd!2026` (2FA removed again); new disposable `m10fresh-1788962613@nexora.dev` / password `RegPassw0rd!2026` (login user-bucket locked until ~14:19 UTC); register IP bucket partly consumed. Long-lived fixture org/user (qa2) untouched.
- In-app verification of click-through navigation (bounce redirects, post-auth landing) relies on SSR + endpoint contract + code review; no browser automation available in this environment.
