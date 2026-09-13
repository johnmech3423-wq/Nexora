# Module 11 — Marketing Website · Completion Report

**Date:** 2026-09-09 · **Status:** Complete — all gates green
**Scope:** Public marketing site under the pre-existing empty `(marketing)` route group. Zero backend changes; frozen Modules 1–10 untouched.

---

## 1. Routes created (all static, all SSR-verified)

| Route | Page | Notes |
|---|---|---|
| `/` | `src/app/(marketing)/page.tsx` | Home: hero, trust strip, feature grid, 5 alternating showcases, CTA |
| `/pricing` | `src/app/(marketing)/pricing/page.tsx` | Rendered **from `PLAN_LIMITS` / `PLAN_PRICING` / `PLANS` in `src/lib/constants.ts`** — the same catalog the server enforces |
| `/features` | `src/app/(marketing)/features/page.tsx` | Catalog grouped by domain incl. a permission matrix and developer API notes |
| `/about` | `src/app/(marketing)/about/page.tsx` | Engineering story with honest scope section |
| `/security` | `src/app/(marketing)/security/page.tsx` | Concrete, verified security architecture (no invented certifications) |
| `(marketing)/layout.tsx` | shared | Skip-link + `SiteHeader` + `<main>` + `SiteFooter`; imports `marketing.css` (prefers-reduced-motion) only for public routes |
| `public/og.png` | asset | 1200×630 branded OG card generated offline with PIL (no external API, no new dependency) |

No placeholder pages: privacy/terms/contact intentionally omitted (no real content/backend behind them); footer "Legal" column omitted for the same reason, per brief.

## 2. Components created

- `src/components/marketing/site-header.tsx` — one client island: sticky navbar (Features/Pricing/Security/About, active state via pathname), Radix dropdown theme control (Light/Dark/System, checkbox semantics), Radix `Sheet` mobile menu with all links + CTAs, skip-link anchor support.
- `src/components/marketing/site-footer.tsx` — server: brand column + Product/Company/Resources groups + dynamic `© {year}`.
- `src/components/marketing/logo.tsx` — `NexoraMark`/`NexoraLogo` matching the in-app “N on primary tile” identity.
- `src/components/marketing/product-previews.tsx` — six static UI previews built from design tokens: `DashboardPreview`, `BoardPreview`, `SprintPreview`, `ChatPreview`, `AnalyticsPreview`, `WebhookPreview` (mini dark app-sidebar chrome, real status colors from `DEFAULT_STATUSES`/priority palette, sample content only).
- `src/app/(marketing)/marketing.css` — reduced-motion enforcement, ships only with marketing chunks.

## 3. Design system reuse

ThemeProvider (next-themes, default `system`) from the root layout — marketing pages are wrapped by the same Providers as the app. Tailwind v4 tokens only (`bg-card`, `bg-sidebar`, `text-muted-foreground`, chart/status hexes from constants); `buttonVariants` link-styled CTAs (the `Button asChild`+`Link` SSR/Slot pitfall found in Modules 9–10 was deliberately avoided everywhere); lucide icons; Inter font; Radix DropdownMenu/Sheet primitives; shadcn-style Card/border/bg conventions; `cn()` merges.

## 4. Real features represented (all verified in code)

Projects & custom statuses/labels · kanban · subtasks · priorities · due/start dates · estimates · assignees/watchers · sprints & milestones · team calendar · comments w/ replies/mentions/reactions/attachments · chat DMs/groups/project channels w/ typing/presence · notification center · global search · time tracking (timer/manual) · activity log · analytics (trends/distributions/workload) · multi-tenant orgs · RBAC org (owner→guest) + project (manager→viewer) roles · invitations · suspended members · private/archived projects · webhooks (10 event types, HMAC-SHA256, retries, pause/rotate) · typed REST API w/ Zod + error codes · rate limits · sessions/2FA · pluggable realtime bus · optional AI provider layer.

**Truthfulness guardrails:** no fake customers/logos/revenue/testimonials/uptime/certifications; hero previews labeled *“Illustrative product interface”;* pricing page carries an explicit note that **this build does not process payments** (plan info only, owner-managed, enforced server-side); free-tier claims match `PLAN_LIMITS.free` exactly (5 members/3 projects); AI described only as provider abstraction with caps; realtime described as “pluggable transport” (no-op in dev). The features-page role matrix was **corrected mid-build against `src/lib/permissions.ts`**: members can create but not edit/archive/delete projects, and sprint/milestone management is owner/admin-only — the shipped matrix mirrors the registry exactly.

## 5. SEO

Per-page `metadata` (title/description, OpenGraph, `alternates.canonical` resolved via existing `NEXT_PUBLIC_APP_URL` metadataBase). Home carries full OG (title/description/`/og.png` 1200×630). Root title template `%s · Nexora`. Verified in SSR HTML: unique titles, canonical per page, `og:title`, `og:image` absolute URL, one `<h1>` per page.

## 6. Accessibility

Skip-to-content link; semantic landmarks (header/nav/main/footer/section/article/table with caption); single-h1 hierarchy with scoped h2/h3; labeled icon-only buttons (`aria-label`); theme dropdown uses menuitemradio semantics (`aria-checked`); mobile sheet has sr-only title; focus-visible rings on all interactive elements (links, buttons, cards that are links); decorative icons `aria-hidden`; preview avatars/dots aria-hidden; color never sole carrier (labels accompany chips); `prefers-reduced-motion` disables animation/transition globally on marketing routes; WCAG-oriented contrast via existing tokens.

## 7. Responsive & performance QA (no browser automation available)

Code-level viewport audit: 320px+ safe (flex wrap, responsive grid steps `sm/md/lg`, `overflow-x-auto` role table, sheet width 300px, previews scale down with hidden mini-sidebars below `sm`), no fixed-width layouts, no horizontal overflow constructs; hero max-w-5xl. Performance: all marketing pages are **server components, statically prerendered** (verified `○ (Static)` in build output); the only client JS is the header island; zero remote images/fonts beyond bundled Inter; CSS/Tailwind animations only; no client data fetching anywhere on marketing routes; `og.png` is a local 44 KB asset. SSR HTML contains zero app-shell/auth code — marketing never inherits the `(app)` shell.

## 8. Validation results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint .` | **0 errors, 74 warnings — unchanged pre-module baseline (no new warnings)** |
| `npx next build` | **Compiled successfully; all marketing routes static** (`/`, `/about`, `/features`, `/pricing`, `/security`) |
| SSR (anon) | All 5 marketing routes **200, 0 client-render fallbacks** |
| Link integrity | Every internal href on every marketing page resolves to a real route; all `/features#…` anchors present |
| Metadata/OG/canonical | Present and correct in SSR |
| `/og.png` | 200, `image/png`, 44 KB |

## 9. Frozen-module regression (Modules 1–10)

All verified 200 after the module: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding` (anon); `/dashboard`, `/settings/general`, `/settings/members`, `/settings/billing`, `/settings/webhooks`, `/settings/api`, `/calendar`, `/projects` (authenticated fixture session). No auth/app/billing behavior changed; no backend files touched; no edits to frozen page files.

## 10. Known limitations (honest)

- No browser automation in this environment: visual fidelity, dark-mode rendering and mobile-menu interaction were validated via SSR HTML, tokens, build output and code review, not pixel inspection.
- Header CTA uses `/register?next=%2Fdashboard` (safe, same-site; `safeNext` governs on the auth side). Authenticated-user-aware navbar was intentionally skipped per brief §21 (no client auth fetching on static pages).
- Theme menu icon is static (Monitor) until interaction — deliberate to avoid hydration mismatch; state labels/checks update after hydration.
- Realtime/AI capabilities are described with transport/provider caveats because those layers are environment-configured in the running app.
- Legal pages (privacy/terms) not created — footer Legal column omitted to avoid empty placeholders, per brief §2/§12.
