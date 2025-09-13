"use strict";

const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runGenerate } = require("../generate/index");

module.exports = async function build({ flags }) {
  const input = flags.project || ".";
  const verbose = !!flags.verbose;
  const projectRoot = resolveProjectRoot(input);
  // Load config in case we need project metadata (title, etc.) later
  loadConfig(projectRoot);

  console.log(`[vuevn] build → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  try {
    // Prebuild step only: generate minimal @generate/* bridge
    await runGenerate({ projectRoot, verbose });
    console.log("[vuevn] Skipping Vite build (temporarily disabled). Generate step completed.");
  } catch (e) {
    console.error("[vuevn] Build failed:", e.message || e);
    // console.error("[vuevn] Ensure Vite is installed: npm i -D vite @vitejs/plugin-vue");
  }
};
