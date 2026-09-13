# Phase 17 — Admin control plane & production runtime hardening

## Goal
Move runtime integration configuration into the authenticated platform-admin console while keeping immutable bootstrap secrets out of the application database.

## Added
- `/admin/settings` platform settings page.
- Runtime configuration stored in MongoDB in `PlatformConfig`.
- Secrets (SMTP password, Cloudinary secret, AI key, Pusher secret) encrypted at rest with the existing AES-256-GCM secret layer derived from `AUTH_SECRET`.
- Admin-only settings API: `GET/PUT /api/admin/settings`.
- Admin-only connection tests: `POST /api/admin/settings/test` for SMTP and Cloudinary.
- Runtime integration resolution with environment fallback for existing deployments.
- SMTP mailer now uses runtime admin configuration.
- Cloudinary storage now uses runtime admin configuration and a selectable local/cloudinary driver.
- AI provider credentials/config now use runtime admin configuration.
- Pusher server + browser configuration now use runtime admin configuration; browser receives only non-secret realtime values.
- Platform registration can be disabled from admin settings.
- Platform-admin email list can be managed from the admin console, while `ADMIN_EMAILS` remains a deployment-level bootstrap backstop.
- Platform Admin link is visible in the account menu for authorized users.
- Radix Popover dependency path was replaced by a local popover implementation to avoid the current React 19 + Radix Popover runtime Slot crash.
- Global admin/user/notification trigger composition was hardened to avoid unnecessary `asChild` Slot chains.

## Security boundary
The following remain deployment-level and are intentionally NOT editable from the database-backed admin UI:
- `DATABASE_URL`
- `AUTH_SECRET`
- `WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Changing those values at runtime can invalidate sessions, disconnect the database, or make signed webhooks unverifiable.

## Admin login
1. Register/sign in normally at `/login`.
2. The account email must be present in Vercel `ADMIN_EMAILS` for bootstrap access.
3. Open `/admin` or use **Platform admin** from the account menu.
4. Add additional trusted admin emails under `/admin/settings`.
5. Keep the bootstrap email in the DB admin list to prevent accidental lockout.

## Production verification required
The source tree was syntax-checked after these changes. A full `npm ci`, typecheck, lint, test suite and production build could not be executed in this environment because dependency installation timed out. These gates must run in the networked Vercel/CI environment before the next production release.


## Free-first provider presets
The admin settings UI now includes safe presets for a free-first deployment:
- Brevo SMTP: `smtp-relay.brevo.com:587` with STARTTLS-style SMTP configuration.
- Gemini OpenAI-compatible API: `https://generativelanguage.googleapis.com/v1beta/openai/` with `gemini-2.5-flash-lite` as a starter model.
- AI connection test and SMTP/Cloudinary connection tests are available from the admin console.

These presets do not include credentials; the administrator must create their own provider account/key and enter it into the encrypted settings fields. Provider free-tier limits remain external to Nexora.
