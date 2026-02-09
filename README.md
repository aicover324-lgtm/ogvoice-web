# OG Voice (MVP)

Production-grade MVP foundation for a "Voice Cloning / AI Singing" platform.

Scope of this repo:
- Marketing + SEO (App Router, SSR): landing, pricing, FAQ, blog placeholder, legal pages
- Authentication (NextAuth): Credentials (email/password) + optional Google OAuth wiring
- User profiles + per-user "AI Voices" library
- Secure file uploads to S3-compatible storage via pre-signed URLs (MinIO for local dev)
- Training UI/API is intentionally disabled for now (production infra pending)
- "Generate Song" flow (placeholder UI + endpoints)
- Stripe subscription scaffolding (checkout + webhook + billing portal)

This MVP does NOT include any voice cloning model/training implementation. Training will be reintroduced later as a production service.

---

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- Auth: NextAuth (Credentials + optional Google)
- Storage: S3-compatible (AWS S3 / Cloudflare R2 / MinIO)
- Payments: Stripe (test mode)

---

## Local Setup

Prereqs:
- Node.js 20+
- Docker (for Postgres + MinIO)

1) Install dependencies

```bash
pnpm install
```

2) Create `.env`

```bash
cp .env.example .env
```

Update at least:
- `NEXTAUTH_SECRET`

3) Start Postgres + MinIO

```bash
pnpm db:up
```

MinIO console:
- http://localhost:9001
- user: `minio`
- pass: `minio12345`

Bucket is created automatically by `minio-init` service: `ogvoice`.

4) Run migrations

```bash
pnpm prisma:migrate
```

5) Start dev server

```bash
pnpm dev
```

App:
- http://localhost:3000

---

## Key Routes

Public:
- `/` landing
- `/pricing`
- `/faq`
- `/blog`
- `/legal/privacy`
- `/legal/terms`

Auth:
- `/login`
- `/register`

App (protected):
- `/app/dashboard`
- `/app/voices`
- `/app/voices/new`
- `/app/voices/[id]`
- `/app/generate`
- `/app/settings`

---

## Upload Flow (Implemented)

1) Client requests a pre-signed URL

`POST /api/uploads/presign`

```json
{
  "voiceProfileId": "...",
  "type": "dataset_audio",
  "fileName": "take_01.wav",
  "fileSize": 12345678,
  "mimeType": "audio/wav"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "uploadUrl": "https://...",
    "storageKey": "u/<userId>/voices/<voiceId>/dataset/<uuid>_take_01.wav",
    "requiredHeaders": { "Content-Type": "audio/wav" }
  }
}
```

2) Client uploads directly to MinIO/S3 using `PUT uploadUrl`

3) Client confirms the upload

`POST /api/uploads/confirm`

```json
{
  "voiceProfileId": "...",
  "type": "dataset_audio",
  "fileName": "take_01.wav",
  "fileSize": 12345678,
  "mimeType": "audio/wav",
  "storageKey": "u/<userId>/voices/<voiceId>/dataset/..."
}
```

This creates an `UploadAsset` record.

Notes:
- File type + size are validated server-side.
- Plan gating is enforced using environment-based quotas (free/pro scaffolding).
- Dataset uploads are limited to 1 file per voice profile.

---

## Training (Temporarily Disabled)

This repo intentionally does not ship a Google Colab-based runner.

Training will be reintroduced later as a production service (reliable, always-on, and monitorable).

---

## Stripe Scaffolding

Endpoints:
- `POST /api/stripe/checkout` (requires auth)
- `POST /api/stripe/webhook` (public)
- `POST /api/stripe/portal` (requires auth)

Env vars required:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`

---

## Deployment Notes

Recommended:
- Vercel for Next.js
- Managed Postgres (Neon / Supabase / RDS)
- AWS S3 or Cloudflare R2 for object storage

Production tips:
- Replace in-memory rate limiting with Redis (Upstash) to work across serverless instances.
- Ensure `NEXTAUTH_SECRET` is set and rotate secrets properly.

## Storage Lifecycle (Recommended)

This MVP does not automatically delete objects from your bucket.

Recommended production approach:
- Add bucket lifecycle rules:
  - Expire temporary inputs (`.../inputs/...`) after N days
  - Expire generated outputs (`.../generated/...`) after N days, or transition to cheaper storage
- Keep datasets (`.../dataset/...`) until the user deletes a voice profile and you run a purge workflow.

Voice profiles are soft-deleted in the database (deletedAt set). You can later add a background purge that:
- deletes DB rows + S3 objects for deleted voices after a retention period
- emits an AuditLog entry for compliance

## Automatic Cleanup (Implemented)

When a voice profile is deleted, it is marked as deleted (soft delete). A separate cleanup step can permanently remove it later.

Local/manual cleanup:

```bash
pnpm purge
```

This deletes:
- dataset objects from your bucket for voices deleted more than `PURGE_RETENTION_DAYS` ago
- related database rows, then hard-deletes the voice profile row

Optional HTTP trigger (for Vercel Cron):
- `POST /api/maintenance/purge`
- Header: `x-cron-secret: <PURGE_CRON_SECRET>`
