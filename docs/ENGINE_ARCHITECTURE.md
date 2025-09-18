Engine Architecture — @vuevn/cli

Purpose
- Technical overview of the runtime engine as packaged inside the CLI. Focuses on responsibilities, data flow, override model, and stability contracts.

Core Concepts
- Dual‑phase execution: events are simulated first (produce an action list), then played back (user‑driven, save/load friendly).
- Generated imports: all runtime imports resolve from `@generate` indices to allow project/npm plugin overrides without changing engine code.
- Manager pattern: the `Engine` orchestrates a set of focused managers; no monolith.

Modules (by domain)
- Stores (Pinia)
  - `engineState`: UI/engine runtime fields (background, foreground, dialogue, choices, currentEvent, settings, etc.).
  - `gameState`: base game‑level state (time, location, flags/variables). Projects extend/override via plugins.
- Core (engine_src/engine/Core)
  - `Engine`: orchestrator, owns state references and constructs managers; main run loop; calls `handleEvent`, `calculateInfo`, `handleLocation`, `updateActions`.
  - `ActionExecutor`: plays back recorded actions, coordinates `NavigationManager` waits, drives UI updates.
  - `SimulateRunner`: executes VN events to produce actions deterministically; never reads wall‑clock; records snapshots.
  - `EngineSave`: save/load slots, serializes replayable history and state.
  - `WaitManager`: small primitive to await “continue”, choices, and in‑engine barriers.
  - `CustomRegistry` (legacy hook): registration point for `runCustom` actions to mount overlays / mini‑games.
- Managers (engine_src/engine/Managers)
  - `HistoryManager`: manages past/present/future stacks; drives back/forward behavior; integrates with `NavigationManager`.
  - `EventManager`: selects immediate drawable events vs available choices; updates caches after mutations.
  - `ActionManager`: computes accessible actions for current state (for overlay/menus).
  - `NavigationManager`: centralizes waits (continue/choice/action) and state gating; cooperates with history.
  - `InputManager`: keyboard/mouse listeners; routes to navigation (continue/back/forward toggle/skip).
  - `LocationManager`: resolves location data, time‑based backgrounds, resource loading hints.
  - `LanguageManager`: maps `Text` objects to localized strings based on current engine settings.
- Components (engine_src/components)
  - UI elements (menus, dialogue, overlays) referenced via `@generate/components` to allow project overrides.

Data Flow (happy path)
1) Engine loop calls `eventManager.getEvents(gameState)` to determine an immediate event or drawable choices.
2) If immediate event exists → `handleEvent()` → `ActionExecutor.executeEvent(event)`.
   - Simulation: `SimulateRunner` executes event code (async/await), enqueues actions (SHOW_TEXT, SET_BACKGROUND, CHOICES, JUMP, RUN_CUSTOM, ...), records snapshots per step.
   - Playback: `ActionExecutor` replays actions, updates `engineState`, coordinates waits via `NavigationManager`.
3) After event completion: `EventManager.updateEventsCache(gameState)`; loop continues.
4) If no immediate event: `calculateInfo()` → `cleanState()` → `handleLocation()` → `updateActions()` → wait for user action.

History, Save/Load
- Every action increments a step counter and stores a snapshot (game + engine state) for deterministic replay.
- Back/forward navigation replays actions from history; left/right/shift keys mapped by `InputManager`.
- Save slots store replayable sequences; loading reconstructs state and resumes from the last known step.

Override & Plugin Model
- Generated import indices choose the effective source for each symbol (priority):
  - local plugin file (project `plugins/`)
  - npm plugin from `config.ts` (config order)
  - engine default (`@vuevn/engine_src`)
- No engine file should import `@engine`/`@project` directly for runtime; use `@generate` so overrides apply.
- Types under `types/` are re‑exported type‑only to avoid bundling duplicate runtime values.

Events & Actions (API surface)
- VNEvent shape (project): `{ id, name, async execute(engine, state) { ... } }`.
- Engine API (selected):
  - `showText(...)`, `setBackground(image)`, `setForeground(images[])`, `showChoices([...])`, `jump(eventId)`.
  - `runCustom({ id, ...args })` for blocking custom overlays (optional; requires registry binding).
- Contracts: calls must be serializable/deterministic; do not read wall clock or random without seeding.

Internationalization
- `generate/texts` builds a language map per `global/` and `locations/<id>/texts/<scope>/<lang>.ts`.
- `LanguageManager` selects strings based on `engineState.settings.language`; missing keys should be surfaced by verify in build.

Determinism & Debugging
- Simulation never attaches UI; it only records intended actions + state.
- Playback updates UI and honors waits; on error, debug builds may pause to allow inspection.
- For mini‑games, pass a `seed` and keep handlers idempotent across remounts.

Stability Contracts (subject to versioning)
- Generated index paths and precedence rules.
- Core manager method signatures (History/Event/Action/Navigation/Input/Location/Language).
- Engine API methods exposed to events.
- Save/load snapshot format compatibility within a major version.

Planned Improvements
- Formalize an override map (generated doc listing overridable files and their origins).
- Conflict diagnostics during generate (which symbol/file is overridden by which plugin and in what order).
- Verify/i18n integration into CLI build pipeline with blocking/fallback flag.
- Editor integration: one‑click scaffolding via File API endpoints and templates.

