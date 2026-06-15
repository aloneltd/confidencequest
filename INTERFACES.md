# ConfidenceQuest — Integration Contract (the connector law, frozen)

> Every brick conforms to this so the Set wires together with zero drift.
> Plain browser JS. **No ES modules, no bundler, no framework.** All files are classic
> `<script src>` tags loaded in order by `index.html`. Everything hangs off one global
> namespace: **`window.CQ`**. Canvas 2D + WebAudio only. Deploys static (Vercel).

## Load order (index.html includes scripts in THIS order)
1. `js/game-state.js`  → defines `CQ.state`
2. `js/fx-kit.js`      → defines `CQ.fx`
3. `js/companion.js`   → defines `CQ.companion`
4. `js/dashboard.js`   → defines `CQ.dashboard` + registers screen `dashboard`
5. `js/intake.js`      → registers screen `intake`
6. `js/world-map.js`   → registers screen `world-map`
7. `js/games/breathe-runner.js` → registers screen `breathe-runner`
8. `js/games/thought-buster.js` → registers screen `thought-buster`
9. `js/games/power-up-lab.js`   → registers screen `power-up-lab`
10. `js/games/star-forge.js`    → registers screen `star-forge`
11. `js/games/boss-battle.js`   → registers screen `boss-battle`
12. `js/app.js`        → boot: loads content, hydrates state, mounts first screen

Each file begins with: `window.CQ = window.CQ || {};`

## `CQ.state` — the GameState singleton (game-state.js)
Properties (persisted to `localStorage["confidencequest.v1"]`):
- `eventName` (string, the player's typed event, e.g. "job interview at Google")
- `archetype` ("interrogator" | "critic" | "gatekeeper" | "unknown")
- `companion` ({ body:string, color:string, expression:string })
- `level` (int 0..6) · `badges` (string[]) · `unlocks` ({bodies:[],colors:[],accessories:[]})
- `nodes` ({ "breathe-runner":bool, "thought-buster":bool, "power-up-lab":bool, "star-forge":bool, "boss-battle":bool })
- `stat` (int 0..100, the Confidence Stat)

Methods:
- `CQ.state.load()` → hydrate from localStorage on boot (schema-version guarded). Called by app.js.
- `CQ.state.save()` → persist now (called automatically after every mutation helper).
- `CQ.state.reset()` → wipe to defaults (for testing / "start over").
- `CQ.state.set(patch)` → shallow-merge patch into state, then save() + notify().
- `CQ.state.clearNode(id)` → mark a node cleared, recompute `stat`, save(), notify().
- `CQ.state.subscribe(fn)` → register a listener; returns unsubscribe fn.
- `CQ.state.notify()` → call all listeners (screens re-render on change).
- `stat` is derived: each of the 4 training nodes = 20%, boss-battle = 20% → 100% at full clear (satisfies DoD-1: reaches 100%).

## `CQ.fx` — Canvas FX & juice (fx-kit.js)
- `CQ.fx.particleBurst(ctx, x, y, opts)` — opts: {count, colors[], spread, life}
- `CQ.fx.rafLoop(updateFn)` — wraps requestAnimationFrame; updateFn(dt) returns false to stop; returns a stop() handle.
- `CQ.fx.tween(from, to, ms, ease)` — returns a function(t→value) or a promise-like; pick one and document inline.
- `CQ.fx.shake(el, intensity)` — quick screen-shake on an element.
- `CQ.fx.playCue(name)` — WebAudio oscillator cue; names: "level", "win", "zap", "collect", "click". No audio assets. Must no-op gracefully if WebAudio unavailable.

## `CQ.content` — the data pack (content-pack writes data/content.json; app.js loads it into CQ.content)
Shape of `data/content.json`:
```json
{
  "archetypes": {
    "interrogator": { "label": "The Interrogator", "event": "interview",
      "bossLines": ["{event} line with token", "..."],
      "responses": [ {"text": "Tell them about your relevant experience", "courage": 25}, ... (>=3, event-specific) ] },
    "critic":      { "label": "The Critic", "event": "presentation", "bossLines":[...], "responses":[>=3] },
    "gatekeeper":  { "label": "The Gatekeeper", "event": "conversation", "bossLines":[...], "responses":[>=3] },
    "unknown":     { "label": "The Unknown", "event": "date", "bossLines":[...], "responses":[>=3] }
  },
  "thoughtBuster": [ {"anxious": "I'll freeze up", "reframe": "I've prepared and I can pause"}, ... (>=8) ],
  "starPrompts":   [ {"prompt":"Tell me about a time you solved a problem","beats":{"S":"...","T":"...","A":"...","R":"..."}}, ... (>=3) ],
  "strengths":     [ "Name a time you helped someone", "A skill people thank you for", ... (>=6) ]
}
```
`{event}` tokens in bossLines are replaced at runtime with `CQ.state.eventName`.

## `CQ.companion` — avatar + leveling (companion.js)
- `CQ.companion.render(el)` — draw current companion (body/color/expression + glow class `.companion--lvlN` + earned badges/accessories) into element `el`.
- `CQ.companion.levelUp()` — bump `CQ.state.level`, award a badge, unlock a customization option, fire `CQ.fx.particleBurst` + `CQ.fx.playCue("level")`. This is the visible state change ≥2× for DoD-1.
- `CQ.companion.openCustomizer(el)` — render the customization UI (body/color/expression + unlocked accessories), writing choices back via `CQ.state.set({companion:...})`.

## `CQ.screens` — every screen/mini-game registers here
`CQ.screens = CQ.screens || {};`
Each module does: `CQ.screens["<id>"] = { mount(rootEl), unmount() }` where:
- `mount(rootEl)` renders the screen into the given `<section>` element (the section is empty/clean on entry).
- A mini-game, on completion, calls `CQ.state.clearNode("<id>")`, then `CQ.companion.levelUp()`, then `CQ.app.showScreen("world-map")`.
- `unmount()` stops any rafLoop / removes listeners (app.js calls it before switching away).
Screen ids: `intake`, `world-map`, `breathe-runner`, `thought-buster`, `power-up-lab`, `star-forge`, `boss-battle`, `dashboard`.

## `CQ.app` — the shell (app.js)
- `CQ.app.showScreen(id)` — unmount current, hide all `<section>`s, show the `<section id="screen-<id>">`, call `CQ.screens[id].mount(sectionEl)`.
- Boot sequence (DOMContentLoaded): `CQ.state.load()` → fetch `data/content.json` into `CQ.content` → if `CQ.state.eventName` exists show `world-map` else show `intake`.
- index.html: one `<main>` containing `<section id="screen-intake" class="screen">…</section>` per screen, all `.screen{display:none}` except active `.screen--active`.

## `CQ.dashboard` (dashboard.js)
- `CQ.dashboard.computeStat()` — returns 0..100 from cleared nodes (mirrors `CQ.state.stat`).
- Also registers `CQ.screens["dashboard"]`. A persistent Confidence Stat bar may also be rendered in a fixed header by app-shell calling `CQ.dashboard.renderBar(headerEl)`.

## Non-negotiables (every brick)
- Top-of-file comment: what the brick is, its stud, its socket.
- No secrets, no external network calls, no third-party libs.
- Fail loudly in console only on real errors; **no uncaught errors in a normal happy-path run** (DoD-1 requires a clean console).
- Mobile + desktop: pointer events should also handle touch (`pointerdown`), layout responsive via theme-kit utilities.
