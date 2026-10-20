---
description: Publish this Space code to the publisher's own GitHub so artists can fork it and get updates
---

You are helping the publisher (a designer, not a developer) put this project on **their own GitHub**.
Do every step yourself. Before each step, say in one short line what you're doing. Only pause when a
browser sign-in or approval is genuinely needed, and tell them exactly what to click.

1. **Check tools.** Confirm `node -v` is 20 or newer, and that `git` and `gh` (GitHub CLI) exist.
   - If `gh` is missing on macOS: run `brew install gh`. If Homebrew is missing too, install Homebrew first with its official one-line installer, then `gh`.
   - If `node` is missing on macOS: `brew install node`.
2. **Sign in to GitHub.** Run `gh auth status`. If not signed in, run `gh auth login --hostname github.com --git-protocol https --web` and tell them: "A code will appear — press Enter, paste it in the browser, then click Authorize."
3. **Get their username** with `gh api user --jq .login`. Call it `<me>`.
4. **Create the repo and push.**
   - If `.git` doesn't exist: `git init -b main`, `git add -A`, `git commit -m "Space v$(node -p "require('./package.json').version")"`.
   - `gh repo create <me>/space --public --source . --remote origin --push`. (Public so artists can fork it and see exactly what each update changes. If they want it private, explain that artists then need to be invited as collaborators before they can fork.)
   - If a repo called `space` already exists under `<me>`, ask before doing anything to it.
5. **Point updates at it.** Set `UPDATE_FEED_URL=https://raw.githubusercontent.com/<me>/space/main/version.json` as the default in `.env.example`, and replace `<publisher>` with `<me>` in `SETUP.md` and `.claude/commands/launch-space.md`. Commit "Point update feed at <me>/space" and push.
6. **Turn on forking-friendly settings:** `gh repo edit <me>/space --enable-issues=false --enable-wiki=false`.
7. **Finish** by telling them, in 3 short lines:
   - The repo link `https://github.com/<me>/space`.
   - "Artists' Spaces will pull updates from here."
   - "Next: run /launch-space with the artist on a call."
