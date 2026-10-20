# Setting up your Space

This guide gets your own Space running. It takes about 20 minutes and costs nothing on the free plans.

You'll create three free accounts. **All of them are yours.** Your logins, PINs and data live only in *your* accounts. The person who sent you Space can't see any of it.

| Service | What it's for |
|---|---|
| **GitHub** | Holds your copy of the app's code, and receives updates |
| **Supabase** | Your private database |
| **Vercel** | Puts your Space on the internet |

Each step below is one action. Do them in order.

---

## Part 1: Get your copy of the code (GitHub)

1. Go to **github.com** and sign up (or log in).
2. Open the Space link you were sent (it looks like `github.com/<publisher>/space`).
3. Click **Fork** (top right).
4. Click **Create fork**.

You now have your own copy at `github.com/<you>/space`.

5. In your copy, click the **Actions** tab.
6. Click **I understand my workflows, go ahead and enable them**.

That turns on **auto-updates**: new versions arrive on their own, once a day. To skip auto-updates, leave this off. You can update manually any time with **Sync fork → Update branch** on your repo page.

---

## Part 2: Create your database (Supabase)

1. Go to **supabase.com**, then click **Start your project** and sign in with GitHub.
2. Click **New project**.
3. Name it `space`, set a database password (save it somewhere safe), and pick the region closest to you (e.g. *Southeast Asia (Singapore)*).
4. Click **Create new project** and wait about 1 minute.
5. Click **Connect** (top of the page).
6. Under **Transaction pooler**, copy the connection string. It starts with `postgresql://` and ends in `:6543/postgres`.
7. Paste it into a note and replace `[YOUR-PASSWORD]` with the password from step 3.

That's your **DATABASE_URL**.

---

## Part 3: Put it online (Vercel)

1. Go to **vercel.com** and sign up with GitHub.
2. Click **Add New… → Project**.
3. Find your `space` repo and click **Import**.
4. Open **Environment Variables** and add each one below. Type the **Key**, paste the **Value**, then click **Add**.

| Key | Value |
|---|---|
| `DATABASE_URL` | The string from Part 2 |
| `SESSION_SECRET` | Any long random text (40+ characters). A password generator works great. |
| `SETUP_CODE` | A code you make up, e.g. `rockstar-2026`. You'll type it once, on the setup screen. |
| `CRON_SECRET` | Another long random text |
| `UPDATE_FEED_URL` | The link the publisher gave you (leave blank if none) |

5. Click **Deploy** and wait about 2 minutes.
6. Click **Continue to Dashboard**, then copy your site address (e.g. `layyi-space.vercel.app`).
7. Go to **Settings → Environment Variables**, add `APP_URL` = `https://` + your address, and click **Save**.
8. Go to **Deployments**, click the **⋯** next to the latest one, and choose **Redeploy**.

---

## Part 4: Launch your Space

1. Open your site address.
2. On the setup screen, enter your **setup code**, artist name, your name, email, and a **6-digit PIN**.
3. Pick a highlight colour.
4. Click **Launch my Space 🚀**.

You're the **master** account. Next:

Type **LAYYI** as the artist name and your character, photo and dove are set up automatically.

- **Home → Add a goal:** set your goal for the year, then link tasks to it.
- **Team → Add someone → Quick fill from the crew:** adds Gabe, Carissa, Nathan or Shien with their photo and character. Enter their email or phone and share the temporary PIN with them privately.

**Tip:** on your phone, open your Space in Safari or Chrome and choose **Add to Home Screen**. It then opens like an app.

---

## Optional: email reminders

Without this, reminders still arrive inside the app; your pet delivers them. To also send them by email:

1. Go to **resend.com**, sign up, and click **API Keys → Create API Key**. Copy the key.
2. Under **Domains**, add a domain you own and follow the steps to verify it.
3. In Vercel, add the environment variable `RESEND_API_KEY` = your key.
4. Add `EMAIL_FROM` = `LAYYI's Space <hello@yourdomain.com>` (use your verified domain).
5. Redeploy (same as Part 3, step 8).

---

## When reminders go out

Vercel runs these on its own:

- **Every morning, around 9am Malaysia/Singapore time:** tasks due today or overdue.
- **Monday morning:** your week at a glance (in-app + email).
- **Sunday evening, around 6pm:** a prompt to renew your weekly to-do list (in-app + email).

If you live in a very different timezone, change your timezone in **Settings**. Ask the publisher to adjust the times in `vercel.json` for you.

---

## Forgot your PIN?

- An **admin** can reset it from **Team → Edit → Reset PIN**.
- If you're the master and locked out, wait 15 minutes and try again. If you've truly forgotten it, ask the publisher for the one-line database command to reset it. You'll run it yourself in Supabase, so they still never see your data.
