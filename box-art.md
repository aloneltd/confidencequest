# Box Art — ConfidenceQuest

> Stage 0. The picture on the box: what this finished software *is*, and exactly how we'll
> know it's done. Written BEFORE any planning or building. No Definition of Done → no build.

## The finished product (one paragraph)

ConfidenceQuest is a vibrant, character-driven browser game for anyone frozen by a specific dread — an interview, a presentation, a hard conversation, a first date. The player arrives at the live URL, names what's scaring them, and instantly gets a **Companion** — a small animated creature that starts dim and timid, then visibly glows brighter, grows bolder, and gains visible power-up badges as the player progresses. The world opens as an **RPG-style level map** with four distinct nodes, each a genuinely different arcade mini-game secretly running real confidence psychology as its hidden engine. In **Breathe Runner**, a side-scrolling rhythm platformer, the avatar jumps and glides in time with the player's breath cadence — land every beat for 4 inhale/hold/exhale cycles and the level clears (nervous-system regulation dressed as a rhythm game). In **Thought Buster**, anxious-thought gremlins swarm the screen in a fast-paced wave-shooter — the player zaps each one and a reframed version explodes in its place, earning combo multipliers for clearing them fast (CBT reframing dressed as arcade combat). In **Power-Up Lab**, the player collects three Courage Crystals by identifying real strengths and past wins — each crystal visibly upgrades the Companion's stats before the final fight. In **STAR Forge**, a behavioral-interview trainer, the player assembles a real "tell me about a time…" story by snapping story beats into the correct **Situation → Task → Action → Result** order to forge a Courage weapon — scoring bonus points for a complete, well-structured answer and learning the STAR framework that lands behavioral interviews. The climax is **Boss Battle** (Pokémon-battle style): a towering Doubt Boss themed to the player's specific event type — the Interrogator (interview), the Critic (presentation), the Gatekeeper (hard conversation), or the Unknown (date) — appears in full illustrated glory, and the player faces it by choosing courage-responses from a menu, building a Courage Meter charge-by-charge until the boss is defeated and the screen erupts in particles and a level-up sequence. The Companion is deeply customizable: pick body type, color, and expression at the start, then **unlock new body types, colors, and accessories** as rewards for clearing nodes and leveling up. Progress is stored in localStorage — no login, no server — and the dashboard shows a live Confidence Stat panel that fills across all four nodes. Palette: warm amber, vivid teal, electric gold, soft coral — energetic but friendly, like a modern indie game, not a clinical app. Deploys to a static live URL. Works on desktop and mobile.

## Definition of Done — exactly 3 checkable conditions

**DoD-1:** When a first-time player opens the live URL, names their event, customizes their Companion, completes all five mini-games (Breathe Runner, Thought Buster, Power-Up Lab, STAR Forge, Boss Battle), and defeats the Boss, the Companion visibly changes state at least twice (gains glow and at least one badge) and the Confidence Stat panel reaches 100% on the dashboard — confirmed with zero JavaScript errors in the console. _(checkable how: a stranger cold-runs the full path, screens the final dashboard state, and opens DevTools — Companion must show visible visual change at two distinct checkpoints, panel must read 100%, and console must be error-free)_

**DoD-2:** When a player reaches the Boss Battle and their named event is "job interview", the Boss appears with the Interrogator skin and at least three of the player's Courage-response options are labeled with interview-specific language (e.g. "Tell them about your relevant experience", "Ask a thoughtful question back"); repeating with "presentation" shows the Critic skin and presentation-specific response options instead. _(checkable how: tester runs the game twice — once entering "job interview" and once entering "presentation" — screenshots the Boss Battle screen both times and confirms visually distinct Boss skin and at least 3 event-specific dialogue options in each run)_

**DoD-3:** When a returning player reopens the URL on the same device (without clearing browser storage or logging in), their Companion's unlocked badges, their event name, and their Confidence Stat panel percentage are all restored exactly as they were at end of their last session, and the level map shows previously completed nodes as cleared. _(checkable how: tester completes at least two mini-games, closes the browser entirely, reopens the URL — screenshots the level map and dashboard and compares badge count, stat percentage, and event name to their prior session screenshot)_

## The Technical Wall (pre-mapped)

- **The wall:** Delivering four genuinely distinct arcade mini-games (real-time rhythm, wave-shooter, collection mechanic, turn-based boss battle) all sharing a single live Companion/stat state — in a single static browser app with no game engine and no server — while keeping animation and interactivity feeling "juicy" (responsive, animated, particle-ready) across desktop and mobile without frame-rate drops or state-sync bugs between mini-games.
- **Candidate crossing:** Build each mini-game as a self-contained Canvas/DOM module that reads from and writes to a single shared `GameState` object (a plain JS singleton serialized to localStorage). Use `requestAnimationFrame` loops per module, lightweight sprite/particle systems with vanilla Canvas 2D (no Phaser or Three.js — keeps bundle size zero-dependency). Companion visual state is a CSS class set driven by `GameState.level`, so all four modules agree on what the Companion looks like by reading the same source. Module transitions are hard page-section swaps (no router needed). This pattern has been validated in zero-dependency browser games at this complexity level.
- **Fallback if it doesn't fall in a 2-hour time-box:** Simplify Breathe Runner and Thought Buster to DOM-animated interactions (no Canvas) — slightly less arcade-juicy but still interactive and animated — and keep Boss Battle as the only full Canvas module. The shared state architecture stays identical; only the render approach per module changes.

## Run shape (frozen)

- **Build scope:** `ship`
- **Blueprint depth:** `deep`
- **Target:** `web_app` — live URL, browser-native, zero login, zero server
- **Tier:** `large` — five distinct mini-games (incl. STAR behavioral-interview trainer) + boss battle + deep avatar system with unlockables + leveling + badges + dashboard + localStorage persistence + responsive (desktop + mobile)
- **Audience / speed / archetype:** Adults (18–45) facing a specific high-stakes life event; tone is warm, energetic, encouraging — Pokémon/Mario energy with psychological depth hidden under the game surface
- **Accuracy pack:** not armed (anxiety/confidence psychology is the hidden engine, not clinical claims)

## Palette direction

Warm amber `#F5A623` / vivid teal `#00C9B1` / electric gold `#FFD700` / soft coral `#FF6B6B` / deep indigo background `#1A1040`. Friendly, energetic, modern indie — NOT clinical blue, NOT muted earth tones.

## Reuse check (the Lego Store)

- Canvas 2D `requestAnimationFrame` loop — standard browser primitive; zero-dependency, reusable across all four mini-game modules
- Singleton `GameState` + localStorage serializer — lightweight, reusable pattern for future offline browser games in Catalogue
- CSS class-driven avatar/companion state system — drives visual leveling from a shared enum; reusable for any character-progression feature
- Four-archetype intake mapper (interview / presentation / conversation / date) — maps free-text to a labelled archetype; reusable for any event-personalization feature
- Particle burst system (vanilla Canvas 2D) — on level-up / boss defeat; reusable across future games in Catalogue
