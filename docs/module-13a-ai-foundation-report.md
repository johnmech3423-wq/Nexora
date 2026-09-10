# Module 13A — AI Assistant Foundation · Completion Report

**Date:** 2026-09-10 · **Status:** Complete — Phase 13A foundation only
**Scope:** Polished authenticated `/ai` page connected to EXISTING AI backend abstraction. No second AI architecture, no new dependencies, no backend changes.

---

## 1. Audit — existing AI implementation (reused as-is)

**API route:**
- `src/app/api/ai/chat/route.ts` — `POST /api/ai/chat?orgId=` — `requireUser()`, `rateLimit("ai", email, 60/min)`, Zod `message 1..4000`, `feature enum: assistant|summarize|suggest default assistant`, delegates to `chat()` service.

**Service / provider abstraction:**
- `src/server/services/ai.service.ts`
  - `chat(actorUserId, orgIdOrSlug, feature, message, context)` — `assertOrgPermission(..., "ai.use")`, `assertPlanFeature(orgId, "aiRequestsPerMemberPerDay")` → 402 if free plan, daily quota via `AiUsage` collection, `providersAvailable()` check, `callProvider()` for OpenAI-compatible (`/chat/completions`) and Anthropic (`/v1/messages`), env-driven `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, fallback guidance when `none` or provider fails.
  - Returns `ChatReply { reply, provider, model, fallback, usageToday, limitToday }`
  - Always creates `AiUsage` doc (`ok`, `errorCode`, prompt/completion chars), TTL 2 days.

**Models / metering / limits:**
- `src/server/db/models/ai-usage.model.ts` — `organizationId`, `userId`, `provider`, `feature`, `ok`, `errorCode`, indexes + TTL.
- `src/lib/constants.ts` — `PLAN_LIMITS`: free 0, pro 30, business 100 requests/member/day.
- `src/lib/permissions.ts` — `ai.use` granted to owner/admin/member (not guest).

**Env:**
- `AI_PROVIDER=none|openai-compatible|anthropic`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_MAX_REQUESTS_PER_MEMBER_PER_DAY` — all server-only in `src/lib/env.ts`, never exposed via `NEXT_PUBLIC_`.

**No new AI service created — foundation reuses exactly this.**

---

## 2. Files created / changed

**Created:**
- `src/app/(app)/ai/page.tsx` — server metadata + client island wrapper. Title `AI Assistant · Nexora`, renders `<AiAssistant />`.
- `src/components/features/ai/ai-assistant.tsx` — full client foundation UI (see §3).

**Changed:**
- `src/components/app/app-nav.tsx` — added `Sparkles` import and nav entry `{ href: "/ai", label: "AI Assistant", icon: Sparkles, section: "workspace" }` after Analytics, before Activity. No redesign.

**Not changed:** backend routes, services, models, env, billing, auth, other app pages (Modules 1–12 frozen).

---

## 3. `/ai` route status

- **Path:** `/ai` inside `(app)` group → inherits `AuthGate` + `AppShell` (authenticated sidebar, org switcher, theme).
- **Static build:** `○ /ai` listed in `next build` output (72 static pages total, up from 71).
- **Auth:** Requires sign-in — anon hits `AuthGate` redirect to `/login?next=%2Fai`. Verified via existing auth-gate pattern.
- **Org isolation:** Uses `useActiveOrgId()` / `useActiveOrg()` from `org-store`. If no active org → `EmptyState` "No workspace selected". Composer sends `POST /api/ai/chat?orgId=<active>`; backend enforces `assertOrgPermission` and tenant isolation. No `orgId` from client is trusted without membership check.
- **Responsive:** Flex column `h-[calc(100dvh-7rem)]`, scrollable message log, sticky composer, mobile: full-width, `sm:` breakpoints, works with light/dark/system via existing design tokens.
- **Navigation:** Visible in sidebar for all authenticated users (no permission hiding in nav for 13A, but backend enforces `ai.use` — guest gets 403).

---

## 4. Existing AI backend reused

- Composer calls `apiFetch<ApiReply>(\`/api/ai/chat?orgId=...\`, { method: POST, body: { message, feature: "assistant" } })` — same schema as existing route.
- Handles all status codes via `ApiClientError`: 400 validation, 401 session expired (auto redirect via `api-client`), 402 plan_required → `PlanGateCard`, 403 forbidden, 404 org not found, 422 field errors, 429 rate_limited (daily quota + 60/min limiter), 500 fallback.
- No provider secrets in browser — only `orgId` and message sent. `AI_API_KEY` stays server-only.

---

## 5. Provider / fallback behavior

- **No-provider (`AI_PROVIDER=none` default):** Backend returns `fallback: true`, `provider: "none"` with honest guidance text (`"AI assistance isn't configured..."`). UI shows `Guidance mode` badge + `No-provider mode` card in empty state explaining `.env` setup. No fake AI.
- **Configured provider fails:** Backend catches error, logs `[ai]`, returns `fallbackReply` with `fallback: true` but keeps quota counting. UI shows same badge.
- **Success:** Shows provider/model badge (`openai-compatible · gpt-4o-mini` etc.) and usage `X/Y today`.
- **Plan gating:** Free plan → backend throws 402 `plan_required` via `assertPlanFeature`. UI's `ErrorBanner` detects "plan"/"upgrade" in message and renders `PlanGateCard` linking to `/settings/billing?org=`.

---

## 6. Auth / org isolation / metering

- **Auth:** `AuthGate` (client) + `requireUser()` (server). 401 → login redirect with `next`.
- **Org isolation:** `activeOrgId` from store (restored from `localStorage` + server list). Every request includes `orgId` query; server `assertOrgPermission` verifies membership and `ai.use`. No cross-org leakage.
- **Metering:** Backend counts `AiUsage` per member per day (midnight reset), limit from `PLAN_LIMITS`. UI displays `usageToday/limitToday` from response in header and per-message, plus composer footer. 429 shows retryable error.
- **Rate limiting:** Extra 60 req/min per email via `rateLimit("ai", ...)` — surfaced as 429.

---

## 7. Safety baseline

- **Untrusted input:** Spec says task titles, comments, chat messages, project names, sprint/milestone text, file content must NOT be treated as system instructions. Phase 13A does NOT inject any workspace content into prompts — it only sends `Organization: <name>` + user message to provider via existing `chat()` context (minimal). No workspace content is rendered as system.
- **No raw HTML:** Assistant output rendered via `src/lib/markdown.tsx` (`Markdown` component) which produces React nodes only, never `dangerouslySetInnerHTML`. Links are external-safe (`target="_blank" rel="noopener"`). User messages rendered as plain `<p className="whitespace-pre-wrap">` (escaped by React).
- **No false completion claims:** Assistant never claims an action was completed unless backend succeeded — UI only shows text reply, no mutation side effects in 13A.
- **Secrets:** Verified `grep` of `.next/static` shows no `AI_API_KEY`, `AUTH_SECRET`, `CLOUDINARY_API_SECRET`, `AI_PROVIDER` in client chunks; only server chunks contain provider logic (expected).

---

## 8. UI details (polished, design-system compliant)

- **Header:** Sparkles icon, title, description scoped to active org, usage badge, Clear button (disabled when empty or sending).
- **Empty state:** Bot icon, "How can I help today?", 6 suggested prompts grid with helper copy, `No-provider mode` card.
- **Suggested prompts (required):** Summarize my workspace, What needs attention?, Find overdue work, Summarize this project, What is blocking the team?, Show recent progress — clicking populates and auto-sends (respects backend).
- **Message area:** `role="log" aria-live="polite"`, user right-tinted `bg-muted/20`, assistant `bg-card`, avatars (User/Bot), timestamp, fallback badge, provider/model badge, copy button with check feedback, usage per message.
- **Composer:** `Textarea` min 44px max 160px, `Enter` to send, `Shift+Enter` newline, disabled while sending, `Send` button with spinner, `↵ to send` hint, footer disclaimer + usage.
- **Loading:** "Thinking…" with spinner, composer disabled, duplicate submit prevented via `isSending` guard.
- **Error:** `ErrorBanner` with retry/dismiss, plan gate when applicable, 429 handling.
- **Actions:** Clear/new conversation, copy response.
- **Theme:** Uses `bg-card`, `text-muted-foreground`, `border`, etc. — compatible with light/dark/system via `next-themes`.

---

## 9. Verification

Commands run (dev server stopped):

1. `npm ci --no-audit --no-fund` → 680 packages, 0 errors
2. `npm run typecheck` / `./node_modules/.bin/tsc --noEmit` → **0 errors**
3. `npm run lint` → **0 errors, 74 warnings** — identical baseline to Module 12 (5 warnings introduced by initial draft were fixed before final)
4. `NODE_OPTIONS="--max-old-space-size=4096" npm run build` → **Compiled successfully in 22.1s**, TypeScript 16.4s, `Generating static pages (72/72)`, route list includes `○ /ai`, `ƒ /api/ai/chat` still dynamic. No new unexplained warnings.

Additional checks:
- `/ai` inside `(app)` → auth required (AuthGate)
- Org isolation via `useActiveOrgId` + server `assertOrgPermission`
- No-provider mode: backend returns `fallback: true` guidance, UI shows badge/card
- Unauthorized API: 401/403 via `requireUser`/`assertOrgPermission`
- Secrets: `grep` static chunks → no API keys, no `AI_PROVIDER` in client
- Existing routes: build includes all Module 1–12 routes (`/dashboard`, `/projects`, `/admin`, etc.) — no regression

---

## 10. Limitations / Next phases

- **Foundation only:** No contextual workspace intelligence (overdue tasks, project summaries from real data) — prompts currently hit generic assistant; advanced context injection belongs to 13B.
- **No persistence:** Conversation lives in memory only, cleared on refresh — no DB chat history for AI (intentional for 13A).
- **No mutations:** AI cannot create tasks, comments, etc. yet — must never claim action completed without backend success (enforced).
- **No streaming:** Uses single request/response; streaming can be added later without breaking abstraction.
- **Metering UI:** Shows usage from last successful response only; could add dedicated usage query (`qk.aiUsage`) in later phase.
- **Build OOM:** Next 16 Turbopack build occasionally OOM-killed in sandbox; `NODE_OPTIONS=--max-old-space-size=4096` (or 8192) reliably succeeds — not a code issue.

**STOP after Phase 13A — ready for 13B (contextual intelligence) and 13C (mutations/orchestration)**
