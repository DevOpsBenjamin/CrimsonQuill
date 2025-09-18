# @vuevn/cli (WIP)

Canonical path for VueVN projects. Users keep only their project code; engine/editor come from the CLI package.

Usage (local)
- Run directly without linking:
  - `node VueVN_NPM/bin/vuevn.js --help`
  - `node VueVN_NPM/bin/vuevn.js create my-game`
  - `cd my-game && node ../VueVN_NPM/bin/vuevn.js dev`
  - `node ../VueVN_NPM/bin/vuevn.js build`
  - `node ../VueVN_NPM/bin/vuevn.js verify`
- Or via npm scripts from inside a created project:
  - `npm run dev`
  - `npm run build`
  - `npm run verify`
- Linking globally (optional): `npm link` in `VueVN_NPM/` then use `vuevn` globally.

Scaffold without installing
- npx: `npx @vuevn/cli create my-game`
- npm init: `npm create vuevn@latest my-game`

Status & assumptions
- dev/build/verify operate on the current directory and require `package.json` with a `vuevn` field.
- Build outDir defaults to `./dist`.
- Engine/editor are shipped inside the CLI; consumer projects do not embed `engine_src/` or `editor_src/`.
- Peer deps (vite, @vitejs/plugin-vue, vue, pinia) must be installed in the consumer project.
- Distribution goal: single‑file HTML build that runs without a server, with adjacent `global/` and `locations/` assets when needed.

Migration notes / TODO (aligned)
- Dev parity: HMR + in‑editor helpers (file API, one‑click templates for location/event/store/components).
- Verify pipeline: TypeScript check + i18n blocking (flag `/ignore-translations`).
- Create templates: `basic` vs `advance` (force Tailwind/Pinia), language setup.
- Plugin experiment: integrate `vuevn-plugins-inventory` and document a minimal flow.
- Parameterize dev server (ports/hosts) for local/remote.
- Clean up duplicated samples once CLI can run both beginner and advanced demos.

Verify options
- `vuevn verify --verbose` to print detailed output
- `vuevn verify --ignore-translations` to bypass missing i18n keys (build will still proceed)

Local sample for compile testing
- A minimal consumer project exists at `VueVN_Sample/base-sample`.
- It depends on this CLI via a local file dependency to test integration.
