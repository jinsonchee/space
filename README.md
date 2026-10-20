# Space

A command centre for independent artists. Each artist runs their own private copy, which shows up as **“LAYYI's Space”** (artist name + Space).

**Version 1.1.0, the LAYYI build,** includes:

- **PIN login.** Each person logs in with their email or phone plus a 6-digit PIN. Lockout after 5 wrong tries, plus a rate limit per network.
- **Branding.** The artist's logo sits beside the Space icon in the nav, on the login screen, and on the “Welcome back, rockstar” loading screen. Theme colour is Apple Music red (`#fa243c`), changeable in Settings.
- **Real photos everywhere** (sidebar, tasks, team, login). The pixel characters only appear in the Home overview, so it still feels like a professional tool.
- **Retro pixel characters**, drawn from real photos (`src/lib/characters.ts`): LAYYI in her “love” era look (black wolf cut with red and blonde streaks, freckles, one-shoulder top) with her white dove, plus Gabe, Carissa, Nathan and Shien. Characters blink every few seconds. The dove is the Space's mascot and delivers everyone's notifications.
- **Yearly goals instead of XP levels.**
  - A goal is either "finish these linked tasks" (e.g. release the album) or "grow this number" (e.g. reach 8K Spotify listeners).
  - Home shows real progress against where you *should* be today at an even pace, so you can see ahead / on track / behind.
  - It also shows your daily streak, goal tasks this week, and your next goal task.
  - Tasks can be linked to a goal, and progress only moves when real work gets done.
- **Tasks.** List, board (drag and drop) and calendar views. Assign tasks to teammates, add labels, set priority and due dates. Send a nudge in-app or by email; nudges are limited to once every 6 hours per person.
- **My Week.** Daily and weekly to-dos. Roll unfinished goals into next week, and bring over yesterday's leftovers.
- **Reminders.** Sunday-evening “renew your week”, a Monday-morning overview, and daily due/overdue alerts.
- **ClickUp import.** Admins can bring a team's existing ClickUp tasks over from a CSV export (Tasks → Import from ClickUp).
- **Team.** Master, admin and member access. Admins can add people, edit profiles and reset PINs. Only the master can change who is an admin.
  - “Quick fill from the crew” adds Gabe, Carissa, Nathan or Shien with their photo and character in one step.
- **Theming.** One highlight colour on neutral surfaces, a light/dark switch per person, and layouts for desktop and mobile. It can be added to a phone's home screen.
- **Coming in Phase 2:** Inbox & Calendar (Gmail), Daily Trends, and Post Stats. These pages are already in place as previews.

**Launching for an artist:** open this folder in Claude Code and use the built-in commands:
- `/publish-space` puts the code on your GitHub (once).
- `/launch-space` puts an artist's Space live on *their* accounts (do it together on a call).
- `/ship-update` releases a new version to everyone.

The manual route is in **[SETUP.md](SETUP.md)**.

---

## How updates work (for the publisher)

Each artist **forks** your repo and deploys their fork to their own Vercel, connected to their own Supabase database. You never have their database URL, PINs or data.

To ship an update:

1. Make your changes.
2. If the database needs to change, add a new file in `migrations/` (e.g. `002_trends.sql`).
   - Never edit an old migration.
   - Migrations run automatically on every deploy (`npm run build` runs `scripts/migrate.mjs` first), so each artist's database upgrades itself.
3. Bump `version` in **both** `package.json` and `version.json`, and write a short `notes` line in `version.json`. The notes show in the artist's Settings.
4. Push to `main`.

Here's what happens on each artist's side:

- **Auto-updates on:** the *Get Space updates* GitHub Action syncs their fork within 24 hours, and Vercel redeploys it.
- **Auto-updates off:** their Settings page shows “vX is out” with one-click instructions (**Sync fork → Update branch**).

Give artists this as their `UPDATE_FEED_URL`:

```
https://raw.githubusercontent.com/<your-username>/space/main/version.json
```

**Honest privacy note:** artists run whatever code you publish. Only the version number is ever fetched from your side. Still, an update *could* in theory include code that reads their data. Keep the repo public so anyone can see exactly what each update changes.

**One limit of auto-updates:** GitHub's built-in token can't sync changes to files inside `.github/workflows/`. If you edit the workflow itself, artists need to click **Sync fork** once.

---

## Run it locally

```bash
cp .env.example .env.local   # fill in DATABASE_URL (any Postgres), SESSION_SECRET, SETUP_CODE, CRON_SECRET
npm install
npm run migrate
npm run dev                  # http://localhost:3000 → /setup
```

To trigger the reminders by hand:

```bash
curl "http://localhost:3000/api/cron?force=monday" -H "Authorization: Bearer $CRON_SECRET"
```

`force` takes `sunday`, `monday` or `daily`.

## Project map

```
migrations/            SQL schema, applied in order on every deploy
scripts/migrate.mjs    the migration runner
src/lib/sprites.ts     pixel art engine: avatar grids (mirrored halves), hairstyles, pets, palettes
src/lib/characters.ts  LAYYI + crew presets (photo, role, pixel look)
src/lib/goals.ts       goal progress, pace and streak maths
src/lib/levels.ts      platform list + number formatting
src/lib/notify.ts      in-app notifications + Resend email
src/app/(app)/         logged-in pages: Home, Tasks, Week, Team, Profile, Settings, Phase 2 previews
src/app/api/cron/      Sunday / Monday / daily reminders (vercel.json schedules them)
src/app/actions/       server actions (auth, tasks, todos, members, settings, stats)
src/components/        Shell, Pixel (Avatar/Pet/Character), PetDock, LoadingScreen, Logo, PinPad…
```

## Roadmap

- **Phase 2:**
  - Google sign-in for Gmail and Calendar (each artist uses their own Google Cloud project).
  - YouTube, Meta (Instagram/Facebook) and TikTok APIs. These auto-fill the stats table and Post Stats.
  - Spotify followers and popularity.
- **Phase 3:**
  - Daily Trends: top 10 videos tagged `#singersongwriter #originalmusic #popmusic #indiemusic`, ranked by engagement, through a scraping service.
  - A shoot concept for each trend, written by the Claude API (billed separately to the artist's own key).
  - Web push notifications.
