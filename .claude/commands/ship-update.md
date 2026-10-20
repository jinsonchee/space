---
description: Release the current changes as a new Space version to every artist
argument-hint: what changed, in plain words
---

The publisher wants to release an update. Changes described as: $ARGUMENTS

1. Run `npm run typecheck` and `npm run build` (with any local `.env.local`). If either fails, fix it first and explain in one line.
2. If you changed the database, make sure there's a **new** file in `migrations/` — never edit an old one.
3. Bump the version (patch for fixes, minor for new features) in **both** `package.json` and `version.json`, and set `notes` in `version.json` to a short, friendly sentence for artists (it shows in their Settings).
4. Commit with a clear message and push to `main`.
5. Tell the publisher in two lines: the new version number, and "Artists with auto-updates get it within a day; others see 'update available' in Settings."
