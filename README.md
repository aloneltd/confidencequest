# 🎮 ConfidenceQuest

**Name your fear. Level up your hero. Walk in ready.**

ConfidenceQuest is a vibrant, character-driven browser game that helps someone who has lost
confidence rebuild it — pushing away anxiety and getting them ready for a specific thing they're
dreading (a job interview, a presentation, a hard conversation, a first date).

You name what's scaring you, get a **Companion creature** that visibly grows bolder as you play,
and travel a level map of **five mini-games** — each one secretly running real confidence
psychology as its hidden engine — building toward a boss battle against the doubt that's been
holding you back.

## How to play
1. Open the game and type the thing you're working up to.
2. Customize your Companion.
3. Play the five nodes on the world map:
   - **🌬️ Breathe Runner** — a breath-rhythm game that calms your nervous system.
   - **👾 Thought Buster** — zap anxious thoughts and watch them reframe (CBT).
   - **💎 Power-Up Lab** — collect Courage Crystals by naming your real strengths.
   - **⭐ STAR Forge** — learn to nail behavioral "tell me about a time…" interview answers (Situation → Task → Action → Result).
   - **⚔️ Boss Battle** — face the Doubt Boss themed to your exact event and win with courage.
4. Your Confidence Stat fills to 100% and you reach the **"You're Ready"** dashboard.

Progress saves automatically in your browser — **no login, no account, no server.**

## Tech
A zero-dependency static web app: plain HTML, CSS, and vanilla JavaScript (Canvas 2D + WebAudio).
No frameworks, no build step. Deploys to any static host.

## Run locally
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project structure
- `index.html` — entry point + screen sections
- `js/app.js` — boot + screen router (`CQ.app`)
- `js/game-state.js` — shared state + localStorage persistence (`CQ.state`)
- `js/fx-kit.js` — Canvas particle/animation/audio juice (`CQ.fx`)
- `js/companion.js` — avatar customization + leveling (`CQ.companion`)
- `js/world-map.js`, `js/intake.js`, `js/dashboard.js` — screens
- `js/games/*.js` — the five mini-games
- `css/theme.css` — palette + design system
- `data/content.json` — boss dialogue, reframes, STAR & strengths prompts

Built with the Lego Omni-Planner v2 process.
