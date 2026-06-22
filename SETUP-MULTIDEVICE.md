# Multi-Device Setup — ConfidenceQuest

Working on this project across mobile, MacBook Pro, and Mac mini.

## The setup

Three devices, **all signed into the same Claude account (`marksef@alone.ltd`)**:

| Device | App(s) | Role |
|---|---|---|
| 📱 Mobile | Claude app (Code tab) | Steer & review on the go |
| 💻 MacBook Pro M5 | Claude Desktop app | Primary hands-on dev + visual diff review |
| 🖥️ Mac mini | Claude Desktop app | Always-on host; run/review cloud sessions |

The single thing that links all three is the **same Claude account**. That's it.

## What syncs automatically

Because every device is on the same account, **Claude Code cloud sessions sync across all of them**:

- Start a session on any device → it appears in the Desktop app on both Macs *and* the mobile Code tab.
- Same conversation, same diffs, no QR codes, no terminal needed.
- Pick work up on whichever device is in front of you.

For cloud work, you're already done.

## What does NOT sync automatically

The Desktop app syncs **cloud sessions**, not the **files on disk** between your two Macs.
Local file changes travel through **GitHub**.

> **Golden rule:** commit + push before leaving a device → pull when you land on the next.

```bash
# leaving one Mac:
git add -A && git commit -m "wip" && git push

# arriving on the other Mac:
git pull
```

Avoid editing the same files on both Macs without pushing first, or you'll hit merge conflicts.

## Optional: Remote Control (a machine's *local* environment from anywhere)

Cloud sessions can't touch a specific Mac's local filesystem / local MCP servers / local tools.
If you want, say, the Mac mini's *actual* local environment available from your phone or MacBook:

```bash
# on the host Mac (e.g. the always-on Mac mini):
cd confidencequest
claude remote-control --name "mini-local"
```

Then on mobile: **Code tab → scan the QR code** shown in the terminal.

Notes:
- The terminal must stay open.
- Reconnects automatically, but times out after ~10 min if the host goes offline (the always-on Mac mini avoids this).
- For a zero-dependency static web app like this one, you usually won't need Remote Control — cloud sessions are enough.

## Quick reference

| Task | Where | How |
|---|---|---|
| Cloud session from anywhere | Any device | Open Claude Code / claude.ai/code — same account |
| Visual diff review | Mac (Desktop app) | Open the session |
| Steer on the go | Mobile | Code tab |
| Local files of a Mac → phone | Host Mac | `claude remote-control --name "..."` then scan QR |
| Move file changes between Macs | Any Mac | `git push` / `git pull` |

## Run the app locally (any Mac)

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Docs

- Claude Code on the web: https://code.claude.com/docs/en/claude-code-on-the-web
- Remote Control: https://code.claude.com/docs/en/remote-control
- Desktop app: https://code.claude.com/docs/en/desktop-quickstart
