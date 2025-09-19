"use strict";

const fs = require("fs");
const path = require("path");

function resolveProjectRoot() {
  const projectRoot = process.cwd();
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Current working directory is not a valid project folder: ${projectRoot}`);
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

function assertVuevnProject(projectRoot) {
  const pkg = loadPackageJson(projectRoot);
  if (!pkg || Object.keys(pkg).length === 0) {
    throw new Error(`[vuevn] No package.json found in ${projectRoot}. Run 'vuevn create <name>' first.`);
  }
  if (!pkg.vuevn) {
    throw new Error(`[vuevn] Missing 'vuevn' field in package.json. Initialize with 'vuevn create <name>' or add { "vuevn": {} }.`);
  }
  return pkg;
}

function loadConfig(projectRoot) {
  const pkg = assertVuevnProject(projectRoot);
  const name = pkg.name || path.basename(projectRoot);
  const displayName = pkg.displayName || name;
  // outDir is fixed to 'dist' per design
  const outDir = "dist";
  const editorEnabled = !(pkg.vuevn && pkg.vuevn.editor === false);
  return { name, displayName, outDir, editor: { enabled: editorEnabled } };
}

module.exports = { resolveProjectRoot, loadConfig, assertVuevnProject };
