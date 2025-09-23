"use strict";

const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runVerify } = require("../verify");

module.exports = async function verify({ args = [], flags }) {
  const verbose = !!flags.verbose || (args && args.includes('/verbose'));
  const ignoreTranslations = !!flags["ignore-translations"] || (args && args.includes('/ignore-translations'));
  const projectRoot = resolveProjectRoot();
  const cfg = loadConfig(projectRoot);
  console.log(`[vuevn] verify → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  console.log(`[vuevn] config: ${JSON.stringify(cfg)}`);
  try {
    await runVerify({ projectRoot, ignoreTranslations, verbose, ensureGenerate: true });
    console.log(`[vuevn] ✅ Verify passed`);
  } catch (e) {
    console.error(`[vuevn] ❌ Verify failed:`, e && e.message ? e.message : e);
    process.exitCode = 1;
  }
};
