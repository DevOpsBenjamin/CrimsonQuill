# @vuevn/cli (WIP)

Minimal CLI scaffold for VueVN migration. This is an early stub to validate command routing.

## Usage (local)

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

Linking globally (optional, for local machine testing):
- `npm link` in `VueVN_NPM/` (requires permission to write to global npm). Then use `vuevn` anywhere.

## Status
- dev/build/verify operate on the current directory and require a `package.json` with a `vuevn` field.
- outDir is fixed to `./dist` for builds.
- Engine and editor code are provided by the CLI package; projects do NOT contain `engine_src` or `editor_src`.

## Local sample for compile testing
- A minimal consumer project exists at `VueVN_Sample/base-sample`.
- It depends on this CLI via a local file dependency to test integration.
