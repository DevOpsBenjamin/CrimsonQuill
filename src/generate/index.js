"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    console.log(`[vuevn] generate: deleting folder ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function listFilesRecursive(dir, exts = [".ts", ".vue"]) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...listFilesRecursive(full, exts));
    } else if (entry.isFile()) {
      if (exts.includes(path.extname(entry.name))) out.push(full);
    }
  }
  return out;
}

function groupByTopFolder(baseDir) {
  const groups = {};
  if (!fs.existsSync(baseDir)) return groups;
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folder = entry.name;
    const files = listFilesRecursive(path.join(baseDir, folder));
    groups[folder] = files.map((abs) => ({
      name: path.basename(abs).replace(/\.(ts|vue)$/i, ""),
      absPath: abs,
      relPath: path.relative(baseDir, abs),
      ext: path.extname(abs),
    }));
  }
  return groups;
}

async function runGenerate({ projectRoot, verbose }) {
  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");

  // 1) Clean generate folder
  cleanDir(genDir);
  ensureDir(genDir);
  console.log(`[vuevn] generate: created folder ${genDir}`);

  // 2) Build a tree snapshot of engine and project plugins
  const engineTree = groupByTopFolder(path.join(cliRoot, "engine_src", "engine"));
  const projectEngineTree = groupByTopFolder(path.join(projectRoot, "plugins", "engine"));

  const indexData = {
    note: "tree snapshot for generate rework PoC",
    engine: engineTree, // { Core: [{name, absPath, relPath, ext}, ...], Managers: [...] }
    project: {
      plugins: {
        engine: projectEngineTree,
      },
    },
  };

  const ts = `// Auto-generated: development tree snapshot. DO NOT EDIT.
export const tree = ${JSON.stringify(indexData, null, 2)} as const;
`;
  fs.writeFileSync(path.join(genDir, "index.ts"), ts, "utf8");
  console.log("[vuevn] generate: wrote generate/index.ts (tree snapshot)");
}

module.exports = { runGenerate };
