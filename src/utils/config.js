"use strict";

const fs = require("fs");
const path = require("path");

function resolveProjectRoot(inputPath) {
  const cwd = process.cwd();
  const projectRoot = path.resolve(cwd, inputPath || ".");
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Project path not found or not a directory: ${projectRoot}`);
  }
  return projectRoot;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadPackageJson(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  try {
    const txt = fs.readFileSync(pkgPath, "utf8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function loadConfig(projectRoot) {
  const pkg = loadPackageJson(projectRoot);
  const name = pkg.name || path.basename(projectRoot);
  const displayName = pkg.displayName || name;
  const outDir = (pkg.vuevn && pkg.vuevn.outDir) || "generate";
  const editorEnabled = !(pkg.vuevn && pkg.vuevn.editor === false);
  return { name, displayName, outDir, editor: { enabled: editorEnabled } };
}

module.exports = { resolveProjectRoot, loadConfig };
