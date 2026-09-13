# Phase 16 — Production & Deployment Readiness

## Target

- Hosting: Vercel
- Database: MongoDB Atlas
- Runtime: Node.js 20+
- Persistent object storage: Cloudinary
- Transactional email: SMTP provider

## Required production variables

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL` — HTTPS Vercel production URL
- `AUTH_SECRET`
- `WEBHOOK_SECRET`
- `ADMIN_EMAILS` — recommended for the platform owner/admin account
- `STORAGE_DRIVER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

Optional features remain disabled unless explicitly configured:

- AI: `AI_PROVIDER=none`
- Realtime: `REALTIME_DRIVER=none`
- Billing: `BILLING_PROVIDER=none`
- Google/GitHub OAuth: `NEXT_PUBLIC_*_ENABLED=false`

If an optional provider is enabled, its corresponding credentials are required by the production configuration guard.

## Vercel filesystem rule

Do not use `STORAGE_DRIVER=local` in production. Vercel serverless execution does not provide persistent application-local storage. Production Nexora uses Cloudinary for uploaded files.

The development mail outbox is also not a production delivery mechanism. Configure SMTP in Vercel for verification emails, invitations, password resets, and notifications.

## Deployment order

1. Create/configure MongoDB Atlas database and network access.
2. Create Cloudinary credentials and a production upload folder strategy.
3. Configure an SMTP provider and verified sender address.
4. Import the repository into Vercel.
5. Set all production environment variables in Vercel for Production (and Preview only when desired).
6. Deploy.
7. Verify `/`, `/login`, registration, email verification, password reset, organization creation, project/task flows, file upload, and admin access.
8. Run a production security/smoke checklist before treating the deployment as complete.

## Security notes

- Never commit `.env` or production secrets.
- `AUTH_SECRET` and `WEBHOOK_SECRET` must be long random values.
- `NEXT_PUBLIC_*` values are browser-visible; do not put secrets there.
- `ADMIN_EMAILS` is a server-side allowlist.
- AI, billing, and realtime are opt-in and can remain disabled for a zero-paid-provider deployment.
