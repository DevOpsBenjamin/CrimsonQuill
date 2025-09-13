# @vuevn/cli (WIP)

Minimal CLI scaffold for VueVN migration. This is an early stub to validate command routing.

## Usage (local)

- Run directly without linking:
  - `node VueVN_NPM/bin/vuevn.js --help`
  - `node VueVN_NPM/bin/vuevn.js dev --project .`
  - `node VueVN_NPM/bin/vuevn.js build --project .`
  - `node VueVN_NPM/bin/vuevn.js verify --project .`
  - `node VueVN_NPM/bin/vuevn.js create my-game`

- Or via npm scripts from inside `VueVN_NPM`:
  - `npm run dev`
  - `npm run build`
  - `npm run verify`

Linking globally (optional, for local machine testing):
- `npm link` in `VueVN_NPM/` (requires permission to write to global npm). Then use `vuevn` anywhere.

## Status
- Commands are stubs that only parse options and print intent.
- CLI is plain Node.js (CommonJS) with zero runtime deps.
- Real implementation will follow the migration plan (`NPM_CLAUDE_PLAN.md`).

## Local sample for compile testing
- A minimal consumer project exists at `VueVN_Sample/base-sample`.
- It depends on this CLI via a local file dependency to test integration.
