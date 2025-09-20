"use strict";

const fs = require("fs");
const path = require("path");

function whichBin(projectRoot, names) {
  for (const n of names) {
    const p = path.join(projectRoot, 'node_modules', '.bin', n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function verifyTypes({ projectRoot, verbose = false }) {
  const bin = whichBin(projectRoot, ['vue-tsc', 'tsc']);
  if (!bin) {
    if (verbose) {
      console.warn("[vuevn] TypeScript checker not found (vue-tsc/tsc). Skipping typecheck. Install dev deps: typescript vue-tsc");
    }
    return { success: true, skipped: true };
  }
  const args = ['--noEmit'];
  if (path.basename(bin) === 'vue-tsc') {
    // vue-tsc has same flag
  }
  await new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn(bin, args, { stdio: verbose ? 'inherit' : 'ignore', cwd: projectRoot, env: process.env });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`TypeScript check failed with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
  return { success: true, skipped: false };
}

module.exports = { verifyTypes };

