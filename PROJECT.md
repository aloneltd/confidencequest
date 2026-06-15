# ConfidenceQuest — live & connected

> Written by Stage 6. The durable record of this finished, deployed project — what it is,
> where it lives, and **how to update it**. Any future chat reads this to re-open and ship changes.

## Status
- **Live URL:** https://confidence-game-nine.vercel.app  ·  verified: yes, 2026-06-15 (HTTP 200, assets + content.json 200, real game served)
- **Repo:** https://github.com/aloneltd/confidencequest  (public)
- **Host:** Vercel project `confidence-game` — **auto-deploy connected** (every push to `main` redeploys)
- **Data:** none (all progress is browser localStorage — no server, no DB)
- **Auth:** none (no login by design)
- **Stack:** zero-dependency static site — HTML + CSS + vanilla JS (Canvas 2D + WebAudio). No framework, no build step.

## How to update it (the whole point)
```bash
# 1. make your change in the code
git add -A && git commit -m "what changed"
git push                      # → Vercel auto-redeploys to the live URL in ~1 min
```
Or in a new chat: `/lego-omni-planner-v2` in this folder → it detects the finished project and
offers **Update** (make the change, run the affected gates, push, redeploy, re-verify the live URL).

## Secrets (names only)
- None. This app has no secrets, no API keys, no environment variables — it is fully static and client-only.

## Definition of Done (what "working" means)
1. **DoD-1:** A first-time player who names their event, customizes their Companion, and completes all five mini-games (Breathe Runner, Thought Buster, Power-Up Lab, STAR Forge, Boss Battle) sees the Companion visibly change state ≥2× (glow + badge) and the Confidence Stat reach 100%, with zero JS console errors. ✅ verified live.
2. **DoD-2:** "job interview" → Interrogator boss skin + ≥3 interview-specific responses; "presentation" → Critic skin + different responses; the player's typed event name is substituted into boss lines. ✅ verified live (both archetypes distinct).
3. **DoD-3:** A returning player (no login, same device) has badges, event name, Confidence Stat %, and cleared map nodes all restored from localStorage. ✅ verified live (full reload restored state).

## Monitoring
- Weekly manual check: open https://confidence-game-nine.vercel.app and confirm it loads and a quick run reaches the world map.
- Quick health curl: `curl -so /dev/null -w "%{http_code}" https://confidence-game-nine.vercel.app` (expect 200).
- Vercel dashboard shows deployment status/alerts for each push.

## Known limitations (honest list, all non-catastrophic)
- localStorage required for progress to persist across sessions; in private-browsing it plays fine but doesn't save (no error shown to user).
- Audio is silent until the first user tap (browser autoplay policy) — game fully functional without sound.
- Breathe Runner beat timing can drift slightly on very slow/throttled devices; the level still clears.

## Catalogue
- Saved as a reusable Set in Stage 7: `confidencequest` — parameters: event archetypes/boss themes, palette, companion option sets, content pack (reframes / STAR prompts / strengths / boss dialogue). Re-instantiate for a new theme by editing `data/content.json` + `css/theme.css`.
