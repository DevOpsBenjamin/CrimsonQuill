"use strict";

const fs = require("fs");
const path = require("path");
const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runGenerate } = require("../generate/index");

module.exports = async function dev({ flags }) {
  const verbose = !!flags.verbose;
  const projectRoot = resolveProjectRoot();
  const config = loadConfig(projectRoot);
  console.log(`[vuevn] dev → project: ${projectRoot}`);
  if (verbose) console.log(`[vuevn] verbose enabled`);
  console.log(`[vuevn] config: ${JSON.stringify(config)}`);
  try {
    // Always generate @generate content before dev (mandatory)
    await runGenerate({ projectRoot, verbose });

    // Use the CLI's vite-dev/vite.config.js directly (no generated config)
    const cliRoot = path.resolve(__dirname, "../..");
    const cfgPath = path.join(cliRoot, 'vite-dev', 'vite.config.js');

    // Spawn vite dev with that config
    const viteBin = path.join(projectRoot, 'node_modules', '.bin', 'vite');
    if (!fs.existsSync(viteBin)) {
      throw new Error("Vite CLI not found in project. Install it with: npm i -D vite @vitejs/plugin-vue");
    }
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn(viteBin, ['--config', cfgPath], { stdio: 'inherit', cwd: projectRoot, env: process.env });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Vite dev exited with code ${code}`));
      });
      child.on('error', (err) => reject(err));
    });
  } catch (e) {
    console.error("[vuevn] Failed to start dev server:", e.message || e);
    console.error("[vuevn] Ensure Vite is installed: npm i -D vite @vitejs/plugin-vue");
  }
};
