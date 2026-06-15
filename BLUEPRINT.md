# Blueprint — ConfidenceQuest

> Stage 2 output. The box-art contract lifted into a *buildable* architecture. The prose plan
> answers "what & why"; the **brick manifest** + **wiring diagram** answer "what to build and how
> it connects." Architecture before code. Zero-dependency static browser game (HTML/CSS/vanilla
> JS + Canvas 2D) — no framework, no server, no build step; deploys to a static host.

## 1. The Set at a glance

ConfidenceQuest is a 14-brick static browser game. Five **foundation bricks** (`app-shell`,
`theme-kit`, `game-state`, `fx-kit`, `content-pack`) provide the page, the look, the single shared
state, the juice library, and all archetype text. On top sit the **flow bricks**: `intake-screen`
captures the dread and maps it to one of four archetypes; `companion-system` owns the avatar,
leveling, glow and badges; `world-map` gates the five nodes; the **five mini-games**
(`breathe-runner`, `thought-buster`, `power-up-lab`, `star-forge`, `boss-battle`) each run as a
self-contained Canvas/DOM module that reads and writes the one `GameState` singleton; and
`dashboard` shows the Confidence Stat climbing to 100%. Every mini-game shares `fx-kit` for juice
and `game-state` for truth, so all screens always agree on the Companion and the stat.

```
                                  ┌───────────── theme-kit (css/theme.css) ─────────────┐
                                  │              fx-kit (js/fx-kit.js)                   │
                                  │              content-pack (data/content.json)        │
                                  ▼                                                      ▼
<URL> ─▶ [ app-shell ] ─▶ [ intake-screen ] ─▶ [ companion-system ] ─▶ [ world-map ] ─┐
            (router)        (event→archetype)     (avatar/level/badges)   (node gating) │
               │                   │                      ▲                              │
               │                   │                      │ levelUp                      ▼
               │                   ▼                 [ 5 mini-games ] ─clearNode()─▶ [ game-state ]
               │            (eventName/archetype)    breathe·thought·                (localStorage)
               │                   │                 powerup·star·boss                    │
               ▼                   ▼                      │                               ▼
        [ dashboard ] ◀────── Confidence Stat 0–100% ◀────┴───────────────────────▶ [ boss-battle ]
                                                                              (archetype skin + DoD-2)
```

## 2. Brick manifest

| # | Brick | Reuse/build | Stud (input) | Socket (output) | Maps to DoD |
|---|---|---|---|---|---|
| 1 | `app-shell` | build | box-art.json, theme.css, game-state.js | index.html, js/app.js | DoD-1 |
| 2 | `theme-kit` | build | box-art.json | css/theme.css | DoD-1 |
| 3 | `game-state` | build | localStorage:confidencequest.v1 | js/game-state.js | DoD-1, DoD-3 |
| 4 | `fx-kit` | build | css/theme.css | js/fx-kit.js | DoD-1 |
| 5 | `content-pack` | build | box-art.json | data/content.json | DoD-2 |
| 6 | `intake-screen` | build | game-state.js, content.json | js/intake.js | DoD-2 |
| 7 | `companion-system` | build | game-state.js, fx-kit.js, theme.css | js/companion.js | DoD-1, DoD-3 |
| 8 | `world-map` | build | game-state.js, companion.js, theme.css | js/world-map.js | DoD-1, DoD-3 |
| 9 | `breathe-runner` | build | game-state.js, fx-kit.js | js/games/breathe-runner.js | DoD-1 |
| 10 | `thought-buster` | build | game-state.js, fx-kit.js, content.json | js/games/thought-buster.js | DoD-1 |
| 11 | `power-up-lab` | build | game-state.js, fx-kit.js, content.json | js/games/power-up-lab.js | DoD-1 |
| 12 | `star-forge` | build | game-state.js, fx-kit.js, content.json | js/games/star-forge.js | DoD-1 |
| 13 | `boss-battle` | build | game-state.js, fx-kit.js, content.json | js/games/boss-battle.js | DoD-1, DoD-2 |
| 14 | `dashboard` | build | game-state.js, companion.js | js/dashboard.js | DoD-1, DoD-3 |

## 3. Wiring diagram

_Which socket feeds which stud. No dangling joints — every `from`/`to` prefix is a manifest brick id._

| From brick.socket | To brick.stud | Contract that must match |
|---|---|---|
| theme-kit.css | app-shell.styles | theme.css palette + layout tokens linked by index.html |
| game-state.singleton | app-shell.bootstrap | GameState load()/save(); app.js hydrates on boot |
| app-shell.router | intake-screen.mount | showScreen('intake') → intake.init(container) |
| app-shell.router | world-map.mount | showScreen('world-map') → world-map.init(container) |
| app-shell.router | companion-system.mount | showScreen('customize') → customization UI |
| app-shell.router | dashboard.mount | showScreen('dashboard') → dashboard.init(container) |
| app-shell.router | breathe-runner.mount | showScreen('breathe-runner') → start(canvas) |
| app-shell.router | thought-buster.mount | showScreen('thought-buster') → start(canvas) |
| app-shell.router | power-up-lab.mount | showScreen('power-up-lab') → mount UI/canvas |
| app-shell.router | star-forge.mount | showScreen('star-forge') → ordering UI |
| app-shell.router | boss-battle.mount | showScreen('boss-battle') → start(canvas) |
| content-pack.data | intake-screen.content | archetype labels for confirmation copy |
| intake-screen.archetype | boss-battle.skin | GameState.archetype ∈ interrogator/critic/gatekeeper/unknown |
| intake-screen.eventName | dashboard.banner | GameState.eventName rendered in banner/summary |
| intake-screen.eventName | boss-battle.tokens | eventName substituted into {event} tokens |
| content-pack.data | thought-buster.lines | {anxious, reframe} pairs |
| content-pack.data | star-forge.prompts | ordered S/T/A/R beat sets |
| content-pack.data | power-up-lab.prompts | strengths prompt list |
| content-pack.data | boss-battle.dialogue | per-archetype tree + ≥3 event-specific options |
| fx-kit.api | breathe-runner.juice | rafLoop/particleBurst/playCue |
| fx-kit.api | thought-buster.juice | particleBurst/playCue on zap + clear |
| fx-kit.api | power-up-lab.juice | particleBurst on crystal collect |
| fx-kit.api | star-forge.juice | forge burst + cue on correct assembly |
| fx-kit.api | boss-battle.juice | particle finale + shake on defeat |
| fx-kit.api | companion-system.juice | particleBurst + cue on levelUp |
| game-state.api | intake-screen.write | writes eventName + archetype then save() |
| game-state.api | companion-system.read | reads level/badges/unlocks; writes customization |
| game-state.api | world-map.read | reads node clear flags + bossUnlocked |
| game-state.api | dashboard.read | reads stat/badges/eventName via computeStat() |
| breathe-runner.progress | game-state.write | clearNode + levelUp + save() |
| thought-buster.progress | game-state.write | clearNode + levelUp + save() |
| power-up-lab.progress | game-state.write | clearNode + levelUp + save() |
| star-forge.progress | game-state.write | clearNode + levelUp + save() |
| boss-battle.victory | game-state.write | bossCleared, stat=100, final evolution + save() |
| companion-system.visual | world-map.portrait | renderCompanion(portraitEl, GameState) |
| companion-system.visual | dashboard.portrait | renderCompanion + badge/unlock summary |
| world-map.gate | boss-battle.unlock | entry guarded by isBossUnlocked() (4 nodes cleared) |
| theme-kit.classes | companion-system.styles | .companion--lvl0..5 glow/tier classes |

## 4. Build sequence

_Topologically ordered. Parallel where bricks are independent (each in its own worktree)._

1. **Wave 0 — Foundations (parallel):** `theme-kit`, `game-state`, `fx-kit`, `content-pack`.
   These have no inter-dependencies (theme-kit and content-pack read only box-art; game-state and
   fx-kit are self-contained). Build all four at once.
2. **Wave 1 — Shell + intake (after Wave 0):** `app-shell` (needs theme.css + game-state.js to
   bootstrap), then `intake-screen` (needs game-state + content-pack). Can overlap once app-shell's
   showScreen contract is stubbed.
3. **Wave 2 — Companion + the five mini-games (parallel):** `companion-system` first (world-map and
   dashboard render it), then the five mini-games `breathe-runner`, `thought-buster`,
   `power-up-lab`, `star-forge`, `boss-battle` build fully in parallel — each only depends on the
   already-finished `game-state`, `fx-kit`, `content-pack` contracts, so they never block each other.
4. **Wave 3 — Integration (after Wave 2):** `world-map` (gates the five nodes, needs companion +
   game-state) and `dashboard` (needs companion + game-state). These wire the foundation and
   mini-games into the playable loop and enforce the boss-battle unlock gate.
5. **Wave 4 — Cold-run acceptance:** full path through all five nodes, verify DoD-1/2/3.

## 5. DoD coverage check

- **DoD-1** (cold run → Companion changes ≥2×, Stat = 100%, zero console errors) → `app-shell`,
  `theme-kit`, `game-state`, `fx-kit`, `companion-system`, `world-map`, all five mini-games
  (`breathe-runner`, `thought-buster`, `power-up-lab`, `star-forge`, `boss-battle`), `dashboard`.
  Companion's two-checkpoint visual change comes from `companion-system.levelUp`; 100% from
  `dashboard.computeStat` reaching full on `boss-battle.victory`.
- **DoD-2** (job interview → Interrogator skin + ≥3 interview options; presentation → Critic skin +
  different options) → `intake-screen` (free-text → archetype), `content-pack` (per-archetype
  dialogue + ≥3 event-specific options with {event} tokens), `boss-battle` (selects skin + options
  by archetype, substitutes eventName).
- **DoD-3** (returning player → badges, event name, stat %, cleared nodes restored from localStorage)
  → `game-state` (load/save/serialize), `companion-system` (badges/unlocks from state), `world-map`
  (cleared-node visuals from state), `dashboard` (event name + stat % from state).

All three DoD numbers appear in at least one brick's `covers_dod`. ✅

## 6. The wall & the risks

- **Technical wall:** Five genuinely distinct arcade mini-games (real-time rhythm platformer,
  wave-shooter, collection mechanic, STAR ordering puzzle, turn-based boss battle) all sharing a
  single live Companion/stat state in a zero-dependency static browser app — no engine, no server —
  while keeping animation juicy across desktop and mobile without frame-rate drops or state-sync bugs.
  **Crossing:** every mini-game is a self-contained module that reads/writes the one `GameState`
  singleton (serialized to localStorage) and shares `fx-kit` for particles/audio/tweens; per-module
  `requestAnimationFrame` loops via `fx-kit.rafLoop`; Companion visuals are CSS classes driven by
  `GameState.level` so all modules agree by construction. Hard section swaps, no router lib.
- **Strongest contrarian risk (Rick's seat):** *Scope creep across five mini-games* — the most
  likely failure is not a state-sync bug but five shallow, janky half-games that each feel like a
  prototype, blowing the time-box and missing the "genuinely fun" bar in the box art.
  **Mitigation:** (1) shared `fx-kit` so every game inherits the same juice cheaply instead of
  re-rolling effects; (2) a frozen `game-state` clearNode/levelUp contract so a mini-game is "done"
  the moment it can clear its node — no gold-plating; (3) a **"fun floor" per game** — one clear
  win condition, one juicy success burst, one companion level-up — and the box-art **fallback**:
  drop Breathe Runner and Thought Buster to DOM-animated interactions, keeping Boss Battle as the
  only full Canvas module, with the shared-state architecture unchanged.
- **Secondary risks:** `file://` fetch of `data/content.json` can fail offline → inline the pack or
  load via a tiny module export instead of fetch. localStorage schema drift on return visits →
  version key (`confidencequest.v1`) + guarded `load()`. Mobile rAF jank → cap particle counts and
  pause loops on screen swap.
