---
description: Put an artist's Space live on the artist's OWN GitHub, Supabase and Vercel accounts (run together on a call)
---

You are launching a Space for an artist. The publisher is running this on their laptop while on a call
with the artist. **Everything must end up in the artist's accounts, and the publisher must not keep
any access afterwards.** Neither of them is a developer: do all the work yourself, say what you're doing
in one short line before each step, and only stop when a human has to sign in or click Authorize. When
that happens, say exactly who should do it ("Artist: sign in with YOUR account…").

Never print, log or write to disk the database URL or any generated secret, except where step 9 says to.

## 0. Ask (one message, then continue)
- Artist name as it should appear (e.g. `LAYYI`).
- Artist's email (they'll log in with it).
- Artist's city → choose the nearest regions: Singapore/Malaysia → Supabase `ap-southeast-1`, Vercel `sin1`, timezone `Asia/Singapore`.

## 1. Tools
Check `node -v` (≥ 20), `git`, `gh`. Use `npx --yes vercel@latest` and `npx --yes supabase@latest` (no global installs needed).
Find the publisher repo from `git remote get-url origin` (e.g. `<publisher>/space`). If there is no remote, stop and ask them to run `/publish-space` first.

## 2. Artist's GitHub
- Ask: "Artist, do you have a GitHub account? If not, create one now at github.com/signup (free) — tell me when done."
- `gh auth login --hostname github.com --git-protocol https --web` → the **artist** approves in their browser (use their laptop if possible; otherwise they type their own password while you wait). gh keeps the publisher's account too; check with `gh auth status`.
- `gh auth switch` to the artist's account. Get `<artist>` with `gh api user --jq .login`.
- Fork: `gh repo fork <publisher>/space --clone=false --default-branch-only`.
- Turn on auto-updates in the fork: `gh workflow enable get-updates.yml -R <artist>/space` (if it errors because Actions are disabled on the fork, run `gh api -X PUT repos/<artist>/space/actions/permissions -F enabled=true -f allowed_actions=all` then retry).

## 3. Secrets (generate, keep in memory only)
`SESSION_SECRET` and `CRON_SECRET`: `openssl rand -hex 32` each. `SETUP_CODE`: two short words + 2 digits (e.g. `velvet-moon-42`). Database password: `openssl rand -base64 24 | tr -d '/+='`.

## 4. Artist's Supabase (database)
- `npx --yes supabase@latest login` → **artist** signs in (GitHub sign-in is fine) and approves.
- `npx --yes supabase@latest orgs list` → if none, ask the artist to create a free organisation at supabase.com/dashboard, then continue.
- `npx --yes supabase@latest projects create "<artist name>-space" --org-id <org> --db-password <db password> --region ap-southeast-1` → note the project ref.
- Wait until it's ready (poll `projects list` every 15 s, up to 5 min).
- Get the **transaction pooler** connection string from the Supabase Management API: `GET https://api.supabase.com/v1/projects/<ref>/config/database/pooler` with the CLI's access token (it's stored by `supabase login`; on macOS also try the keychain entry "Supabase CLI"). Build `postgresql://postgres.<ref>:<db password>@<db_host>:6543/postgres`. If you can't get it automatically, ask the artist to open Supabase → their project → **Connect** → **Transaction pooler**, copy the string and paste it to you, then insert the password.
- Sanity check without printing the URL: `DATABASE_URL=… node scripts/migrate.mjs` — it should print "applied 001…" and "database up to date".

## 5. Artist's Vercel (hosting)
- `npx --yes vercel@latest logout` (in case the publisher is signed in), then `npx --yes vercel@latest login` → **artist** signs up/signs in (Continue with GitHub is easiest, using their GitHub from step 2).
- In a temp folder: `gh repo clone <artist>/space space-<artist>` and `cd` into it.
- `npx --yes vercel@latest link --yes --project <artist>-space`.
- `npx --yes vercel@latest git connect` → if it asks to install the Vercel GitHub app, the **artist** approves it for the `space` repo. This makes every update auto-deploy.
- Add env vars for **production** by piping values on stdin (never as arguments):
  `printf '%s' "$VALUE" | npx --yes vercel@latest env add NAME production` for `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `SETUP_CODE`, `UPDATE_FEED_URL` (= `https://raw.githubusercontent.com/<publisher>/space/main/version.json`).
- Deploy: `npx --yes vercel@latest deploy --prod --yes` → note the production URL.
- `printf '%s' "https://<production domain>" | npx --yes vercel@latest env add APP_URL production`, then deploy again.

## 6. Check it works
- `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://<domain>/` → expect a redirect to `/setup`.
- `curl -s https://<domain>/api/cron -H "Authorization: Bearer $CRON_SECRET"` → expect `{"ok":true…}`.

## 7. Hand over
Tell the artist (and only show these once):
- Their link: `https://<domain>`
- Their setup code: `<SETUP_CODE>`
- "Open the link on your phone or laptop, enter the setup code, type **<artist name>** as the artist name, your name, your email and a 6-digit PIN. Your character, photo and dove load automatically."
- "Save this link to your home screen: Share → Add to Home Screen."
- Suggest they store the setup code in their password manager (it's only needed once).

## 8. Optional email reminders
Ask if they want reminder emails now. If yes: they sign up at resend.com, create an API key and paste it to you; add `RESEND_API_KEY` and `EMAIL_FROM` (`<Artist> 's Space <onboarding@resend.dev>` works for testing; their own domain later) with `vercel env add`, then redeploy.

## 9. Remove the publisher's access (do not skip)
- `npx --yes vercel@latest logout`
- `npx --yes supabase@latest logout`
- `gh auth logout --hostname github.com --user <artist>` and `gh auth switch` back to the publisher.
- Delete the temp clone folder (`space-<artist>`) and any `.vercel` folder inside it.
- Confirm: "Done. Everything lives in <artist>'s accounts; this laptop no longer has access."
