"use strict";

const path = require("path");
const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runGenerate } = require("../generate/index");
const { startDevServer } = require("../vite/dev");

module.exports = async function dev({ flags }) {
  const input = flags.project || ".";
  const verbose = !!flags.verbose;
  const projectRoot = resolveProjectRoot(input);
  const config = loadConfig(projectRoot);
  console.log(`[vuevn] dev → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  console.log(`[vuevn] config: ${JSON.stringify(config)}`);
  try {
    // Always generate minimal @generate content before dev
    await runGenerate({ projectRoot, verbose });
    await startDevServer({ projectRoot, config });
  } catch (e) {
    console.error("[vuevn] Failed to start dev server:", e.message || e);
    console.error("[vuevn] Ensure Vite is installed: npm i -D vite @vitejs/plugin-vue");
  }
};
