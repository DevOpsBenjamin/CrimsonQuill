#!/usr/bin/env node

const loaders = {
  dev: () => import('../src/commands/dev.js'),
  build: () => import('../src/commands/build.js'),
};

(async () => {
  const argv = process.argv.slice(2);
  const cmd = (argv[0] && !argv[0].startsWith('-')) ? argv.shift() : 'build'; // défaut: build
  const loader = map[cmd];
  if (!loader) {
    console.error(`[cq] Unknown command: ${cmd}`);
    process.exit(1);
    return;
  }
  try {
    const mod = await loader();
    const run = mod.default ?? mod.run;
    await Promise.resolve(run({ args: argv }));
  } catch (err) {
    console.error('\n[cq] Error:', err?.stack || err);
    process.exitCode = 1;
  }
})();
