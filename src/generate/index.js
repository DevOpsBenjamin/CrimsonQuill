"use strict";

const fs = require("fs");
const path = require("path");
let fse;
let fg;
function requireFromProject(mod, projectRoot) {
  const { createRequire } = require('module');
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req(mod);
  } catch {}
  return require(mod);
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

function normalize(p) {
  return p.replace(/\\/g, "/");
}

function createTreeFromPaths(baseDir, filePaths, sourceTag) {
  const root = { files: [], dirs: {} };
  for (const rel of filePaths) {
    const parts = normalize(rel).split("/");
    const filename = parts.pop();
    let node = root;
    for (const seg of parts) {
      if (!seg) continue;
      node.dirs[seg] = node.dirs[seg] || { files: [], dirs: {} };
      node = node.dirs[seg];
    }
    const ext = path.extname(filename);
    const name = filename.replace(/\.(ts|vue)$/i, "");
    const srcTag = (typeof sourceTag === 'string') ? { source: sourceTag } : (sourceTag || { source: 'unknown' });
    node.files.push({
      name,
      ext,
      found_files: [
        {
          ...srcTag,
          relPath: normalize(rel),
          absPath: normalize(path.join(baseDir, rel)),
        },
      ],
    });
  }
  return root;
}

function buildTree(dir, baseDir, sourceTag, options = {}) {
  const { patterns = ["**/*.ts", "**/*.vue"], ignore = ["**/node_modules/**", "**/.git/**", "**/.vite/**", "**/.vuevn_tmp/**", "**/dist/**", "**/generate/**", "**/.*"] } = options;
  if (!fse.pathExistsSync(dir)) return { files: [], dirs: {} };
  const cwd = dir;
  const entries = fg.sync(patterns, { cwd, dot: false, ignore, onlyFiles: true, followSymbolicLinks: true });
  return createTreeFromPaths(baseDir, entries, sourceTag);
}

function mergeTrees(engineNode, pluginNode) {
  const out = { files: [], dirs: {} };
  // merge files by key (name|ext)
  const map = new Map();
  for (const f of (engineNode.files || [])) {
    const key = `${f.name}|${f.ext}`;
    map.set(key, { name: f.name, ext: f.ext, found_files: [...(f.found_files || [])] });
  }
  for (const f of (pluginNode.files || [])) {
    const key = `${f.name}|${f.ext}`;
    if (map.has(key)) {
      const v = map.get(key);
      v.found_files.push(...(f.found_files || []));
    } else {
      map.set(key, { name: f.name, ext: f.ext, found_files: [...(f.found_files || [])] });
    }
  }
  out.files = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name) || a.ext.localeCompare(b.ext));

  // merge dirs
  const dirNames = new Set([...(engineNode.dirs ? Object.keys(engineNode.dirs) : []), ...(pluginNode.dirs ? Object.keys(pluginNode.dirs) : [])]);
  for (const name of dirNames) {
    const e = (engineNode.dirs && engineNode.dirs[name]) || { files: [], dirs: {} };
    const p = (pluginNode.dirs && pluginNode.dirs[name]) || { files: [], dirs: {} };
    out.dirs[name] = mergeTrees(e, p);
  }
  return out;
}

function extractPluginsFromConfig(projectRoot) {
  const cfgPathTs = path.join(projectRoot, 'config.ts');
  const cfgPathJs = path.join(projectRoot, 'config.js');
  let src = '';
  if (fse.pathExistsSync(cfgPathTs)) src = fse.readFileSync(cfgPathTs, 'utf8');
  else if (fse.pathExistsSync(cfgPathJs)) src = fse.readFileSync(cfgPathJs, 'utf8');
  else return [];
  const m = src.match(/plugins\s*:\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  const arr = m[1];
  const names = [];
  const re = /['"]([^'\"]+)['"]/g;
  let mm;
  while ((mm = re.exec(arr)) !== null) names.push(mm[1]);
  return names;
}

async function runGenerate({ projectRoot, verbose }) {
  // Resolve deps from the CLI package first, fallback to project if necessary
  try { fse = require('fs-extra'); } catch {}
  try { fg = require('fast-glob'); } catch {}
  if (!fse) { try { fse = requireFromProject('fs-extra', projectRoot); } catch {} }
  if (!fg) { try { fg = requireFromProject('fast-glob', projectRoot); } catch {} }
  if (!fse || !fg) {
    throw new Error("[vuevn] Missing CLI deps: fs-extra/fast-glob not found. Ensure @vuevn/cli is installed with its dependencies.");
  }

  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");

  // 1) Clean generate folder
  cleanDir(genDir);
  ensureDir(genDir);
  console.log(`[vuevn] generate: created folder ${genDir}`);

  // 2) Full, agnostic, infinite-depth tree snapshot, merging engine and project plugins
  const engineBase = path.join(cliRoot, "engine_src");
  const engineTree = buildTree(engineBase, engineBase, "engine");
  const pluginTree = buildTree(path.join(projectRoot, "plugins"), path.join(projectRoot, "plugins"), "plugin");
  let mergedTree = mergeTrees(engineTree, pluginTree);

  // Merge npm plugins declared in config.ts (in order)
  const pluginNames = extractPluginsFromConfig(projectRoot);
  if (pluginNames.length) {
    const { createRequire } = require('module');
    const req = createRequire(path.join(projectRoot, 'package.json'));
    for (const pkgName of pluginNames) {
      try {
        const pkgJsonPath = req.resolve(path.posix.join(pkgName, 'package.json'));
        const pkgRoot = path.dirname(pkgJsonPath);
        const npmTree = buildTree(pkgRoot, pkgRoot, { source: 'npm-plugin', pkg: pkgName });
        mergedTree = mergeTrees(mergedTree, npmTree);
        if (verbose) console.log(`[vuevn] generate: merged npm plugin ${pkgName}`);
      } catch (e) {
        console.warn(`[vuevn] generate: plugin '${pkgName}' not found. Install it or fix config.ts`);
      }
    }
  }

  // 3) Separate domain trees (project-only): global and locations
  const globalTree = buildTree(path.join(projectRoot, "global"), path.join(projectRoot, "global"), "project");
  const locationsTree = buildTree(path.join(projectRoot, "locations"), path.join(projectRoot, "locations"), "project");

  // Split a tree into a version without 'texts' and a texts-only subtree
  function splitTexts(node) {
    const locNode = { files: [...(node.files || [])], dirs: {} };
    const txtNode = { files: [], dirs: {} };
    for (const [name, child] of Object.entries(node.dirs || {})) {
      if (name === 'texts') {
        // capture the texts subtree (do not keep it in locNode)
        txtNode.dirs['texts'] = child;
        continue; // exclude from locations
      }
      const { loc, txt } = splitTexts(child);
      locNode.dirs[name] = loc;
      if (txt && (Object.keys(txt.dirs || {}).length || (txt.files || []).length)) {
        txtNode.dirs[name] = txt;
      }
    }
    return { loc: locNode, txt: txtNode };
  }
  const { loc: locationsNoText, txt: locationsTexts } = splitTexts(locationsTree);
  const { loc: globalNoText, txt: globalTexts } = splitTexts(globalTree);
  // Merge texts from global and locations into a single texts domain tree
  const textsTree = mergeTrees(globalTexts, locationsTexts);

  const indexData = {
    note: "tree snapshot for generate rework PoC (agnostic, deep)",
    tree: mergedTree,
    domain: {
      global: globalNoText,
      location: locationsNoText,
      texts: textsTree,
    },
  };

  const ts = `// Auto-generated: development tree snapshot. DO NOT EDIT.\n` +
             `export const tree = ${JSON.stringify(indexData, null, 2)} as const;\n`;
  fs.writeFileSync(path.join(genDir, "index.ts"), ts, "utf8");
  console.log("[vuevn] generate: wrote generate/index.ts (tree snapshot)");

  // Also write a simplified JSON tree for debugging (files as names only)
  function simplify(node) {
    return {
      files: (node.files || []).map(f => f.name),
      dirs: Object.fromEntries(
        Object.entries(node.dirs || {}).map(([k, v]) => [k, simplify(v)])
      ),
    };
  }
  const simple = simplify(mergedTree);
  fs.writeFileSync(path.join(genDir, "tree.json"), JSON.stringify(simple, null, 2) + "\n", "utf8");
  console.log("[vuevn] generate: wrote generate/tree.json (debug)");

  const simpleDomain = { global: simplify(globalNoText), location: simplify(locationsNoText), texts: simplify(textsTree) };
  fs.writeFileSync(path.join(genDir, "domain.json"), JSON.stringify(simpleDomain, null, 2) + "\n", "utf8");
  console.log("[vuevn] generate: wrote generate/domain.json (debug)");

  // 4) Build overlay aggregators: mirror engine_src tree into generate/**/index.ts
  const outEngineRoot = genDir;
  ensureDir(outEngineRoot);

  function chooseSource(foundFiles) {
    // Priority: local plugin > npm plugins (in config order) > engine
    const local = (foundFiles || []).find(ff => ff && (ff.source === 'plugin'));
    if (local) {
      return { kind: 'plugin', rel: normalize(local.relPath) };
    }
    if (pluginNames && pluginNames.length) {
      let best = null;
      for (const name of pluginNames) {
        const hit = (foundFiles || []).find(ff => ff && ff.source === 'npm-plugin' && ff.pkg === name);
        if (hit) { best = hit; break; }
      }
      if (best) {
        return { kind: 'npm', spec: normalize(path.posix.join(best.pkg, best.relPath)) };
      }
    }
    const core = (foundFiles || []).find(ff => ff && (ff.source === 'engine'));
    if (core) {
      return { kind: 'engine', rel: normalize(core.relPath) };
    }
    return null;
  }

  function stripExt(p) { return p.replace(/\.(ts|vue)$/i, ""); }

  function writeIndexForNode(node, relDirParts) {
    const outDir = path.join(outEngineRoot, ...relDirParts);
    ensureDir(outDir);
    const lines = [];
    for (const f of (node.files || [])) {
      const pick = chooseSource(f.found_files || []);
      if (!pick) continue;
      const symbol = f.name; // Convention: default export aliased by filename
      let spec;
      if (pick.kind === 'plugin') spec = `@plugins/${stripExt(pick.rel)}`;
      else if (pick.kind === 'npm') spec = stripExt(pick.spec);
      else if (pick.kind === 'engine') spec = `@vuevn/engine_src/${stripExt(pick.rel)}`;
      lines.push(`export { default as ${symbol} } from '${spec}';`);
    }
    const indexPath = path.join(outDir, "index.ts");
    fs.writeFileSync(indexPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
    if (verbose) console.log(`[vuevn] generate: wrote ${normalize(path.relative(projectRoot, indexPath))}`);

    for (const [sub, child] of Object.entries(node.dirs || {})) {
      writeIndexForNode(child, [...relDirParts, sub]);
    }
  }

  writeIndexForNode(mergedTree, []);
}

module.exports = { runGenerate };
