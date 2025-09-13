"use strict";

const { resolveProjectRoot, loadConfig } = require("../utils/config");

module.exports = async function verify({ flags }) {
  const verbose = !!flags.verbose;
  const projectRoot = resolveProjectRoot();
  const cfg = loadConfig(projectRoot);
  console.log(`[vuevn] verify → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  console.log(`[vuevn] config: ${JSON.stringify(cfg)}`);
  console.log("[vuevn] (stub) This will run typecheck, lint, validations.");
};
