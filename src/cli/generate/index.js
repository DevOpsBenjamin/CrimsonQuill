"use strict";

const path = require("path");
const { createRequire } = require("module");
let fse;
let fg;

function requireFromProject(mod, projectRoot) {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req(mod);
  } catch {}
  return require(mod);
}

function requireFromCliInstall(mod, projectRoot) {
  try {
    const reqFromProject = createRequire(path.join(projectRoot, 'package.json'));
    const cliPkg = reqFromProject.resolve('@crimsonquill/cli/package.json');
    const reqCli = createRequire(cliPkg);
    return reqCli(mod);
  } catch {}
  return null;
}

async function ensureDeps(projectRoot) {
  fse = requireFromCliInstall('fs-extra', projectRoot) || fse;
  fg = requireFromCliInstall('fast-glob', projectRoot) || fg;
  if (!fse) { try { fse = require('fs-extra'); } catch {} }
  if (!fg) { try { fg = require('fast-glob'); } catch {} }
  if (!fse) { try { fse = requireFromProject('fs-extra', projectRoot); } catch {} }
  if (!fg) { try { fg = requireFromProject('fast-glob', projectRoot); } catch {} }
  if (!fse || !fg) throw new Error("[vuevn] Missing CLI deps: fs-extra/fast-glob not found.");
}

function ensureDir(dir) {
  fse.ensureDirSync(dir);
  return dir;
}

function cleanDir(dir) {
  if (fse.pathExistsSync(dir)) {
    console.log(`[vuevn] generate: deleting folder ${dir}`);
    fse.removeSync(dir);
  }
}

const { buildTree, mergeTrees } = require('./tree');
const { writeOverlayFromTree } = require('./overlayWriter');
const { writeProjectStructure } = require('./projectWriter');
const { writeTextsTree } = require('./textsWriter');
const { extractPluginsFromConfig, extractLanguagesFromConfig } = require('./configExtract');
const { normalize } = require('./utils');
const { generateAssetsIndex } = require('./assetIndexGenerator');

async function runGenerate({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");
  cleanDir(genDir);
  ensureDir(genDir);
  try { const { symbols } = require('../utils/log'); console.log(`${symbols.gen} Created folder ${normalize(genDir)}`); } catch { console.log(`[vuevn] generate: created folder ${genDir}`); }

  const engineBase = path.join(cliRoot, "engine_src");
  const engineTree = buildTree(engineBase, engineBase, "engine");
  const pluginTree = buildTree(path.join(projectRoot, "plugins"), path.join(projectRoot, "plugins"), "plugin");
  let mergedTree = mergeTrees(engineTree, pluginTree);

  const pluginNames = extractPluginsFromConfig(projectRoot);
  if (pluginNames.length) {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    for (const pkgName of pluginNames) {
      try {
        const pkgJsonPath = req.resolve(path.posix.join(pkgName, 'package.json'));
        const pkgRoot = path.dirname(pkgJsonPath);
        const npmTree = buildTree(pkgRoot, pkgRoot, { source: 'npm-plugin', pkg: pkgName });
        mergedTree = mergeTrees(mergedTree, npmTree);
        if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear} Merged npm plugin ${pkgName}`); } catch { console.log(`[vuevn] generate: merged npm plugin ${pkgName}`); } }
      } catch (e) {
        console.warn(`[vuevn] generate: plugin '${pkgName}' not found. Install it or fix config.ts`);
      }
    }
  }

  const globalTree = buildTree(path.join(projectRoot, "global"), path.join(projectRoot, "global"), "project");
  const locationsTree = buildTree(path.join(projectRoot, "locations"), path.join(projectRoot, "locations"), "project");

  function splitTexts(node) {
    const locNode = { files: [...(node.files || [])], dirs: {} };
    const txtNode = { files: [], dirs: {} };
    for (const [name, child] of Object.entries(node.dirs || {})) {
      if (name === 'texts') { txtNode.dirs['texts'] = child; continue; }
      const { loc, txt } = splitTexts(child);
      locNode.dirs[name] = loc;
      if (txt && (Object.keys(txt.dirs || {}).length || (txt.files || []).length)) txtNode.dirs[name] = txt;
    }
    return { loc: locNode, txt: txtNode };
  }
  const { loc: locationsNoText, txt: locationsTexts } = splitTexts(locationsTree);
  const { loc: globalNoText, txt: globalTexts } = splitTexts(globalTree);
  function unwrapTextsRoot(node) {
    if (!node || typeof node !== 'object') return { files: [], dirs: {} };
    const dirNames = Object.keys(node.dirs || {});
    if ((node.files || []).length === 0 && dirNames.length === 1 && dirNames[0] === 'texts') return node.dirs['texts'];
    return node;
  }
  const textsTree = { files: [], dirs: {} };
  const gTxt = unwrapTextsRoot(globalTexts);
  const lTxt = unwrapTextsRoot(locationsTexts);
  if (gTxt && (Object.keys(gTxt.dirs || {}).length || (gTxt.files || []).length)) textsTree.dirs['global'] = gTxt;
  if (lTxt && (Object.keys(lTxt.dirs || {}).length || (lTxt.files || []).length)) textsTree.dirs['location'] = lTxt;

  writeOverlayFromTree({ mergedTree, outRootDir: genDir, pluginNames, verbose, projectRoot });
  writeProjectStructure({ projectRoot, outDir: genDir, verbose });
  writeTextsTree({ projectRoot, outDir: genDir, verbose });
}

async function runGenerateTexts({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const genDir = path.join(projectRoot, 'generate');
  ensureDir(genDir);
  writeTextsTree({ projectRoot, outDir: genDir, verbose });
}

async function runGenerateEngine({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");
  ensureDir(genDir);

  const engineBase = path.join(cliRoot, "engine_src");
  const engineTree = buildTree(engineBase, engineBase, "engine");
  const pluginTree = buildTree(path.join(projectRoot, "plugins"), path.join(projectRoot, "plugins"), "plugin");
  let mergedTree = mergeTrees(engineTree, pluginTree);
  const pluginNames = extractPluginsFromConfig(projectRoot);
  if (pluginNames.length) {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    for (const pkgName of pluginNames) {
      try {
        const pkgJsonPath = req.resolve(path.posix.join(pkgName, 'package.json'));
        const pkgRoot = path.dirname(pkgJsonPath);
        const npmTree = buildTree(pkgRoot, pkgRoot, { source: 'npm-plugin', pkg: pkgName });
        mergedTree = mergeTrees(mergedTree, npmTree);
      } catch {}
    }
  }

  if (verbose) {
    try {
      const { symbols } = require('../utils/log');
      function collectFiles(node, base = '') {
        const out = [];
        if (!node) return out;
        for (const f of (node.files || [])) out.push(base + f.name + f.ext);
        for (const [dir, child] of Object.entries(node.dirs || {})) out.push(...collectFiles(child, base + dir + '/'));
        return out;
      }
      function listUnder(root, key) {
        const sub = root && root.dirs ? root.dirs[key] : null;
        return collectFiles(sub).map(p => p.replace(/\.ts$/,'').replace(/\.vue$/,'')).sort();
      }
      const engTypes = listUnder(engineTree, 'types').map(p => (p.startsWith('engine/') ? p : 'engine/' + p));
      const projTypes = listUnder(pluginTree, 'types');
      if (engTypes.length) console.log(`${symbols.gear}  Found ${engTypes.length} engine types: ${engTypes.slice(0, 9).join(', ')}${engTypes.length>9?' ...':''}`);
      if (projTypes.length) console.log(`${symbols.gear}  Found ${projTypes.length} project types: ${projTypes.slice(0, 9).join(', ')}${projTypes.length>9?' ...':''}`);
      const engTypeSet = new Set(engTypes.map(s => s.replace(/^engine\//,'')));
      for (const t of projTypes) {
        if (engTypeSet.has(t)) console.log(`${symbols.override} Project overrides engine type: ${t}`);
        else console.log(`${symbols.add} Project adds new type: ${t}`);
      }

      const engEnums = listUnder(engineTree, 'enums');
      const projEnums = listUnder(pluginTree, 'enums');
      if (engEnums.length) console.log(`${symbols.gear}  Found ${engEnums.length} engine enums: ${engEnums.join(', ')}`);
      if (projEnums.length) console.log(`${symbols.gear}  Found ${projEnums.length} project enums: ${projEnums.join(', ')}`);

      const engStores = listUnder(engineTree, 'stores');
      const projStores = listUnder(pluginTree, 'stores');
      if (engStores.length) console.log(`${symbols.gear}  Found ${engStores.length} engine stores: ${engStores.slice(0, 9).join(', ')}${engStores.length>9?' ...':''}`);
      if (projStores.length) console.log(`${symbols.gear}  Found ${projStores.length} project stores: ${projStores.slice(0, 9).join(', ')}${projStores.length>9?' ...':''}`);
      const engStoreSet = new Set(engStores);
      for (const s of projStores) {
        if (engStoreSet.has(s)) console.log(`${symbols.override} Project overrides engine store: ${s}`);
        else console.log(`${symbols.add} Project adds new store: ${s}`);
      }
    } catch {}
  }

  writeOverlayFromTree({ mergedTree, outRootDir: genDir, pluginNames, verbose, projectRoot });
  if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote engine overlay under ${normalize(path.relative(projectRoot, genDir))}`); } catch { console.log(`[vuevn] generate: wrote engine overlay under ${normalize(path.relative(projectRoot, genDir))}`); } }
}

async function runGenerateProject({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const genDir = path.join(projectRoot, 'generate');
  ensureDir(genDir);
  writeProjectStructure({ projectRoot, outDir: genDir, verbose });
  generateAssetsIndex({ projectRoot, outDir: genDir, verbose });
}

module.exports = { runGenerate, runGenerateTexts, runGenerateEngine, runGenerateProject, extractLanguagesFromConfig };
