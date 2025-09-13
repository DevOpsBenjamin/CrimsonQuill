"use strict";

const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runGenerate } = require("../generate/index");
const { buildGame } = require("../vite/build");

module.exports = async function build({ flags }) {
  const verbose = !!flags.verbose;
  const projectRoot = resolveProjectRoot();
  const cfg = loadConfig(projectRoot);

  console.log(`[vuevn] build → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  try {
    await runGenerate({ projectRoot, verbose });
    await buildGame({ projectRoot, config: cfg, outDir: "dist" });
    console.log("[vuevn] Build completed in ./dist");
  } catch (e) {
    console.error("[vuevn] Build failed:", e.message || e);
    // console.error("[vuevn] Ensure Vite is installed: npm i -D vite @vitejs/plugin-vue");
  }
};
