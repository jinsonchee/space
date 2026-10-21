# Space — notes for Claude Code

Space is a private command centre for an independent artist and their team ("LAYYI's Space").
Next.js 16 (App Router) + Postgres (Supabase) + Vercel. Each artist runs their **own** copy
(a GitHub fork of the publisher's repo) with **their own** database — the publisher never
holds an artist's database credentials.

## Commands in this repo
- `/publish-space` — run by the **publisher** (Jin) once: puts this code on his GitHub so artists can fork it and receive updates.
- `/launch-space` — run by the publisher **together with an artist** to put that artist's Space live on the artist's own GitHub, Supabase and Vercel accounts.
- `/ship-update` — run by the publisher to release a new version to every artist.

## Rules that matter
- Never write an artist's `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` or `SETUP_CODE` into a file in the repo, a commit, or a log. Pass them straight to `vercel env add` via stdin.
- Always use Supabase's transaction pooler (port 6543) with `prepare: false` and `max: 1`. Never switch to session mode (port 5432) — it has a 15-connection limit that Vercel exhausts. Keep `max_pipeline: 0` and use the `transaction()` helper from `src/lib/db.ts` instead of `sql.begin` (see comments there).
- Database changes = a **new** file in `migrations/` (`003_…sql`). Never edit an old migration. `npm run build` runs migrations automatically.
- Releasing: bump `version` in both `package.json` and `version.json`, write `notes` in `version.json`, push to `main`.
- The person running these commands is not a developer. Explain each step in one short plain-English line, do the work yourself, and only stop when a human genuinely has to act (signing in, approving in a browser).

## Useful facts
- Env vars: `DATABASE_URL`, `SESSION_SECRET`, `SETUP_CODE`, `CRON_SECRET`, `APP_URL`, optional `RESEND_API_KEY`, `EMAIL_FROM`, `UPDATE_FEED_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google Calendar + Gmail — each artist uses their own Google Cloud app, created while signed in to the artist's own Google account; tokens are encrypted with a key derived from `SESSION_SECRET`, see `src/lib/crypto.ts`), `YOUTUBE_API_KEY` (public YouTube channel stats, synced daily by the cron).
- Local dev: copy `.env.example` to `.env.local`, `npm install`, `npm run dev`.
- Characters: `src/lib/sprites.ts` (renderer) and `src/lib/characters.ts` (LAYYI + crew presets).
