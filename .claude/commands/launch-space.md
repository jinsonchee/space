---
description: Put an artist's Space live on the artist's OWN GitHub, Supabase and Vercel accounts (run together on a call)
---

You are launching a Space for an artist. The publisher is running this on their laptop while on a call
with the artist. **Everything must end up in the artist's accounts, and the publisher must not keep
any access afterwards.** Neither of them is a developer: do all the work yourself, say what you're doing
in one short line before each step, and only stop when a human has to sign in or click Authorize. When
that happens, say exactly who should do it ("Artist: sign in with YOUR account…").

Never print, log or write to disk the database URL, the database password or any generated secret.
The only secret ever shown is the setup code, once, at the end of the launch script (step 5).

**Never run `supabase` commands inside this repo** — they leave a `supabase/` folder behind. Always use a temp folder.

## 0. Ask (one message, then continue)
- Artist name as it should appear (e.g. `LAYYI`).
- Artist's email (they'll log in with it).
- Artist's city → choose the nearest regions:
  - Singapore/Malaysia → Supabase `ap-southeast-1`, Vercel `sin1`, timezone `Asia/Singapore`.
  - Elsewhere: pick the closest pair, e.g. London → `eu-west-2` / `lhr1`; US East → `us-east-1` / `iad1`; US West → `us-west-1` / `sfo1`.
  The database and the hosting **must** be in the same area, or setup and login will be very slow.

## 1. Tools
- Check `node -v` (≥ 20), `git`, `gh`. Use `npx --yes vercel@latest` and `npx --yes supabase@latest` (no global installs needed).
- Find the publisher repo from `git remote get-url origin` (e.g. `jinsonchee/space`). If there is no remote, stop and ask them to run `/publish-space` first.
- Install this repo's packages so the database setup script can run: `npm install`, then check `node -e 'import("postgres")'` succeeds. If it fails, fix it now — don't continue (the database step depends on it).

## 2. Artist's GitHub
- Ask: "Artist, do you have a GitHub account? If not, create one now at github.com/signup (free) — tell me when done."
- `gh auth login --hostname github.com --git-protocol https --web` → the **artist** approves in their browser (use their laptop if possible; otherwise they type their own password while you wait). gh keeps the publisher's account too; check with `gh auth status`.
- `gh auth switch` to the artist's account. Get `<artist>` with `gh api user --jq .login`.
- Fork: `gh repo fork jinsonchee/space --clone=false --default-branch-only`.
- Turn on auto-updates in the fork: `gh workflow enable get-updates.yml -R <artist>/space` (if it errors because Actions are disabled on the fork, run `gh api -X PUT repos/<artist>/space/actions/permissions -F enabled=true -f allowed_actions=all` then retry).

## 3. Sign the artist in to Supabase and Vercel (before anything is created)
Do all the human sign-ins now, so the launch script in step 5 can run start to finish without stopping.
- `npx --yes supabase@latest login` → **artist** signs in (GitHub sign-in is fine) and approves.
- `npx --yes supabase@latest orgs list` → if none, ask the artist to create a free organisation at supabase.com/dashboard, then continue. Note the org id.
- `npx --yes vercel@latest logout` (in case the publisher is signed in), then `npx --yes vercel@latest login` → **artist** signs up/signs in (Continue with GitHub is easiest, using their GitHub from step 2).

## 4. Prepare the artist's Vercel project (no secrets yet)
- Make a temp folder outside this repo (`mktemp -d`) and clone into it: `gh repo clone <artist>/space <tmp>/space-<artist>`, then work inside that clone.
- `npx --yes vercel@latest link --yes --project <artist>-space`. Note: this writes a `.env.local` with a Vercel login token into the clone — the clone **must** be deleted at the end (step 5's script does it; step 9 double-checks).
- **Set the hosting region** (the old `vercel deploy --regions` flag no longer works and fails silently — functions would land in `iad1`, USA):
  `echo '{"serverlessFunctionRegion":"sin1"}' | npx --yes vercel@latest api /v9/projects/<artist>-space -X PATCH --input -`
  (use the Vercel region from step 0). Check it stuck: `npx --yes vercel@latest api /v9/projects/<artist>-space` should show `"serverlessFunctionRegion":"sin1"`.
- `npx --yes vercel@latest git connect` → if it asks to install the Vercel GitHub app, the **artist** approves it for the `space` repo. This makes every update auto-deploy.

## 5. The launch script (secrets → database → Vercel, in ONE run)
Run everything below as **one bash script** in a single command, so the secrets only ever live in that
script's memory. Write the script file to your scratchpad (it contains no secrets — they're generated
when it runs) and run it with `bash`. Rules for the script:
- Don't use `set -e`. Only the steps **before** the Supabase project exists may stop the script. Every step after that must **warn and continue**, so a late failure never loses the database password or the setup code.
- Keep a list of warnings and print them at the end.
- Use a `trap … EXIT` that deletes the temp folders (the clone from step 4 and the Supabase temp folder), so the clone's `.env.local` token is removed even if something fails.
- Never `echo` the database URL or password, and never pass secrets as command arguments except `supabase link -p` (below).

What the script does, in order:
1. **Generate secrets** (fatal if this fails): `SESSION_SECRET` and `CRON_SECRET` = `openssl rand -hex 32` each; `SETUP_CODE` = two short words + 2 digits (e.g. `velvet-moon-42`); database password = `openssl rand -base64 24 | tr -d '/+='`.
2. **Create the Supabase project** (fatal if this fails — nothing has been created yet):
   `npx --yes supabase@latest projects create "<artist name>-space" --org-id <org> --db-password "$DB_PW" --region ap-southeast-1 >/dev/null 2>&1` (Supabase region from step 0).
   **Don't** try to read the ref from this command's output (`-o json` gets warnings mixed into it and breaks).
3. **Find the project ref by name**: run `npx --yes supabase@latest projects list -o json 2>/dev/null` and pick the entry whose `name` is `"<artist name>-space"` → its `id` is the ref (parse with `node`, starting from the first `[` in case anything else got printed). Retry every 10 s for up to 2 min. If it's still missing, warn: "project was created but I can't find it — the database password can be reset in Supabase → Project Settings → Database".
4. **Wait until it's ready**: poll the same list every 15 s until that project's `status` is `ACTIVE_HEALTHY` (up to 5 min; warn and continue if not).
5. **Get the pooler address** (don't read the CLI token from the keychain — it's blocked): make a second temp folder (`mktemp -d`), and run
   `npx --yes supabase@latest link --project-ref "$REF" -p "$DB_PW" --workdir "$SB_TMP"`, then read `$SB_TMP/supabase/.temp/pooler-url`.
   Take only the **host** from it and build the URL yourself, forcing the transaction-pooler port and the right username:
   `DATABASE_URL="postgresql://postgres.$REF:$DB_PW@$HOST:6543/postgres"`.
   If the file is missing, warn and fall back to `aws-0-<supabase region>.pooler.supabase.com` as the host.
6. **Set up the database**: `(cd <this repo> && DATABASE_URL="$DATABASE_URL" node scripts/migrate.mjs)` — expect "applied 001…" and "database up to date". Warn on failure (Vercel's build runs migrations again anyway).
7. **Add env vars to Vercel** (inside the clone from step 4), piping each value on stdin:
   `printf '%s' "$VALUE" | npx --yes vercel@latest env add NAME production` for `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `SETUP_CODE`, `UPDATE_FEED_URL` (= `https://raw.githubusercontent.com/jinsonchee/space/main/version.json`). Warn on each failure, naming which one.
8. **Deploy**: Vercel prints the URLs to stderr, so capture both:
   `OUT=$(npx --yes vercel@latest deploy --prod --yes 2>&1)`, then take the production domain from the line containing `Aliased` (`grep -i aliased | grep -oE 'https://[^ ]+' | head -1`). If there's no such line, warn and fall back to `https://<artist>-space.vercel.app`. On failure, print the last ~20 lines of `$OUT` (it holds no secrets).
9. **Set APP_URL**: `printf '%s' "https://<production domain>" | npx --yes vercel@latest env add APP_URL production`, then deploy again the same way.
10. **Check it works** (warn only):
    - `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://<domain>/` → expect a redirect to `/setup`.
    - `curl -s https://<domain>/api/cron -H "Authorization: Bearer $CRON_SECRET"` → expect `{"ok":true…}`.
11. **Print the hand-over** — always, even if earlier steps warned: the link (`https://<domain>`), the setup code, and the list of warnings.

After it runs, fix any warnings one by one (most can simply be re-run for the artist's project). If
`DATABASE_URL` didn't make it into Vercel, reset the database password in Supabase → Project Settings →
Database and add it again with a fresh pooler URL — never try to recover the old one.

## 6. Speed check
Open `https://<domain>/setup` once. If it takes more than a few seconds, the region probably didn't stick:
re-run the region step from step 4 (in a fresh temp clone + `vercel link`), redeploy, then delete that clone.

## 7. Hand over
Using the script's output, tell the artist (and only show these once):
- Their link: `https://<domain>`
- Their setup code: `<SETUP_CODE>`
- "Open the link on your phone or laptop, enter the setup code, type **<artist name>** as the artist name, your name, your email and a 6-digit PIN. Your character, photo and dove load automatically."
- "Save this link to your home screen: Share → Add to Home Screen."
- Suggest they store the setup code in their password manager (it's only needed once).

## 8. Optional email reminders
Ask if they want reminder emails now. If yes: they sign up at resend.com, create an API key and paste it to you.
In a fresh temp folder (outside this repo): `gh repo clone <artist>/space`, `vercel link --yes --project <artist>-space`,
add `RESEND_API_KEY` and `EMAIL_FROM` (`<Artist> 's Space <onboarding@resend.dev>` works for testing; their own domain later)
with `printf '%s' … | vercel env add NAME production`, redeploy, then delete that folder.

## 8b. Optional Google: Calendar + Gmail (about 15 minutes)
Ask if they want calendar events (Home, My Week) and their Gmail inbox in Space. If yes, the **artist** does the clicking.
**Before anything: the artist must be signed in to Google with THEIR OWN account** (ideally their music-business account) —
check the profile picture top-right in Google Cloud on every step. If the project is created under the publisher's Google
account, the publisher would control access to the team's Gmail, which breaks the privacy promise. Anyone on the team can
connect their own Google account through the artist's app later.
Give one short step at a time, with the direct link, and wait for "done" each time. `<domain>` is their production domain.
1. **Project:** https://console.cloud.google.com/projectcreate → name `<artist>-space` → **Create**. Make sure the project picker at the top shows it for every step below.
2. **APIs:** https://console.cloud.google.com/apis/library/calendar-json.googleapis.com → **Enable**, then https://console.cloud.google.com/apis/library/gmail.googleapis.com → **Enable**.
3. **Branding:** https://console.cloud.google.com/auth/overview → **Get started** → App name `<Artist>'s Space`, support email → **Next** → **External** → **Next** → contact email → **Next** → tick the policy → **Continue** → **Create** (the page must stop saying "not configured yet").
   Then https://console.cloud.google.com/auth/branding → **Application home page** `https://<domain>`, **privacy policy** `https://<domain>/privacy`, **Authorized domains** → add `<domain>` → **Save**. (Google won't allow publishing without these.)
4. **Data access:** https://console.cloud.google.com/auth/scopes → **Add or remove scopes** → under "Manually add scopes" paste these three lines:
   `https://www.googleapis.com/auth/calendar.events.readonly`
   `https://www.googleapis.com/auth/gmail.modify` (read email + mark as read; Space never deletes or moves email)
   `https://www.googleapis.com/auth/gmail.send`
   → **Add to table** → also tick `openid` and `.../auth/userinfo.email` → **Update** → **Save**. (Gmail shows under "restricted scopes" — expected. Google allows this unverified for personal-use apps under 100 users; tested 2026-10.)
5. **Publish:** https://console.cloud.google.com/auth/audience → **Publish app** → **Confirm** (status "In production"). Ignore the verification notice — unverified is fine for up to 100 people; Testing mode would expire everyone's connection every 7 days.
6. **Client:** https://console.cloud.google.com/auth/clients → **Create client** → **Web application**, name `Space`, **Authorized redirect URIs** → `https://<domain>/api/google/callback` → **Create**.
   - The **Client ID** isn't secret: the artist can paste it in chat → `printf '%s' "<id>" | npx --yes vercel@latest env add GOOGLE_CLIENT_ID --environment production --sensitive` (in a fresh linked temp clone, as in step 8).
   - The **Client secret** must never go through chat or a visible terminal prompt (the plain `vercel env add` prompt echoes it). Write a small script in the temp clone that does `read -rsp` (hidden), strips whitespace, checks it starts with `GOCSPX-`, and pipes it to `vercel env add GOOGLE_CLIENT_SECRET --environment production --sensitive --force`; run it in a terminal tab for the artist to paste into.
7. Redeploy, then the artist opens `https://<domain>/profile` → **Google** card → **Turn on** Calendar and/or Gmail. Tell them first: Google will say "Google hasn't verified this app" → **Advanced** → **Go to … (unsafe)** → keep every box ticked → **Continue**. Expect a green "Connected! ✓".
8. **YouTube stats (optional, 3 min):** https://console.cloud.google.com/apis/library/youtube.googleapis.com → **Enable**. Then https://console.cloud.google.com/apis/credentials → **+ Create credentials → API key** → in the key's settings set **API restrictions → Restrict key → YouTube Data API v3** → **Save**. Save it as `YOUTUBE_API_KEY` with the same hidden-paste script approach as the client secret (`--sensitive`), redeploy, then the artist opens **Settings → YouTube stats** and enters their channel handle (e.g. `@layyi`). Subscribers then update daily (YouTube rounds public counts).
9. **Instagram stats (optional, 5 min; uses the publisher's Meta app "SPACE-IG", so the artist needs no Meta account):**
   - The artist's Instagram must be a **Creator or Business** account (Instagram app → Settings → Account type).
   - Publisher: in https://developers.facebook.com/apps → SPACE-IG → **App roles → Roles → Add people → Instagram tester** → the artist's Instagram username.
   - Artist: accept at https://www.instagram.com/accounts/manage_access/ → **Tester invites** → Accept.
   - Publisher: SPACE-IG → Instagram use case → **API setup with Instagram login → Business login settings → OAuth redirect URIs** → add `https://<domain>/api/instagram/callback` → Save.
   - Add `INSTAGRAM_APP_ID` (not secret, stdin) and `INSTAGRAM_APP_SECRET` (hidden-paste script, `--sensitive`) to the artist's Vercel, redeploy.
   - Artist: **Settings → Instagram stats → Connect Instagram** → log in → Allow.
10. **TikTok stats (optional, 5 min; uses the publisher's TikTok app "SPACE" in Sandbox, max 10 artists):**
   - Publisher: https://developers.tiktok.com → Manage apps → SPACE → **Sandbox** → **Target Users → Add account** → the artist logs in to their TikTok (QR code on their phone).
   - Publisher: same page → Login Kit → **Redirect URI (Web) → Add a URI** → `https://<domain>/api/tiktok/callback` → **Apply changes**.
   - Add `TIKTOK_CLIENT_KEY` (not secret) and `TIKTOK_CLIENT_SECRET` (hidden-paste, `--sensitive`) from the Sandbox's Credentials to the artist's Vercel, redeploy.
   - Artist: **Settings → TikTok stats → Connect TikTok** → Authorize.
If connecting fails, `vercel logs` shows a `[calendar] connect failed: …` line with the reason (e.g. `invalid_client` = wrong secret; "access blocked … being tested" = app still in Testing).

## 9. Remove the publisher's access (do not skip)
- `npx --yes vercel@latest logout`
- `npx --yes supabase@latest logout`
- `gh auth logout --hostname github.com --user <artist>` and `gh auth switch` back to the publisher.
- Make sure every temp clone (`space-<artist>`) and Supabase temp folder is gone — they contain a Vercel login token (`.env.local`) and `.vercel`/`supabase` folders. Delete any that are left.
- Check this repo has no stray `supabase/` folder or `.vercel` folder (`git status` should be clean).
- Confirm: "Done. Everything lives in <artist>'s accounts; this laptop no longer has access."
