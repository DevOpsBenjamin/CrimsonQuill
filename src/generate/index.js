"use strict";

const fs = require("fs");
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
    const cliPkg = reqFromProject.resolve('@vuevn/cli/package.json');
    const reqCli = createRequire(cliPkg);
    return reqCli(mod);
  } catch {}
  return null;
}

async function ensureDeps(projectRoot) {
  // Resolve deps from the installed CLI package inside the project (handles symlink/file:)
  fse = requireFromCliInstall('fs-extra', projectRoot) || fse;
  fg = requireFromCliInstall('fast-glob', projectRoot) || fg;
  // Fallback to Node resolution relative to this file (rarely works with symlinks)
  if (!fse) { try { fse = require('fs-extra'); } catch {} }
  if (!fg) { try { fg = require('fast-glob'); } catch {} }
  // Final fallback to the project root
  if (!fse) { try { fse = requireFromProject('fs-extra', projectRoot); } catch {} }
  if (!fg) { try { fg = requireFromProject('fast-glob', projectRoot); } catch {} }
  if (!fse || !fg) {
    throw new Error("[vuevn] Missing CLI deps: fs-extra/fast-glob not found. Ensure @vuevn/cli is installed with its dependencies.");
  }
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

// Asset scanning moved to separate module
const { buildAssetTree } = require('./assetScanner');

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
  let src = '';
  if (fse.pathExistsSync(cfgPathTs)) src = fse.readFileSync(cfgPathTs, 'utf8');
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

function extractLanguagesFromConfig(projectRoot) {
  const cfgPathTs = path.join(projectRoot, 'config.ts');
  // Load TS by transpiling using the project's TypeScript if available
  try {
    if (fse.pathExistsSync(cfgPathTs)) {
      const ts = requireFromProject('typescript', projectRoot) || requireFromCliInstall('typescript', projectRoot);
      if (ts && ts.transpileModule) {
        const src = fse.readFileSync(cfgPathTs, 'utf8');
        const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } });
        const code = out.outputText;
        const req = createRequire(path.join(projectRoot, 'package.json'));
        const moduleShim = { exports: {} };
        const fn = new Function('require', 'module', 'exports', code);
        fn(req, moduleShim, moduleShim.exports);
        const mod = moduleShim.exports;
        const getCfg = (typeof mod === 'function') ? mod : (mod && typeof mod.default === 'function' ? mod.default : null);
        const cfg = getCfg ? getCfg() : (mod && mod.default ? mod.default : mod);
        const langs = (cfg && cfg.languages) ? cfg.languages.map(l => String(l.code || '').toLowerCase()).filter(Boolean) : [];
        if (langs.length) return langs;
      }
    }
  } catch {}
  // Fallback: static parse languages array from TS file text
  try {
    if (fse.pathExistsSync(cfgPathTs)) {
      const src = fse.readFileSync(cfgPathTs, 'utf8');
      const m = src.match(/languages\s*:\s*\[([\s\S]*?)\]/);
      if (!m) return [];
      const arrSrc = m[1];
      const out = [];
      const re = /code\s*:\s*['\"]([a-zA-Z0-9_-]+)['\"]/g;
      let mm;
      while ((mm = re.exec(arrSrc)) !== null) out.push(String(mm[1]).toLowerCase());
      return out;
    }
  } catch {}
  return [];
}

async function runGenerate({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);

  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");

  // 1) Clean generate folder
  cleanDir(genDir);
  ensureDir(genDir);
  try { const { symbols } = require('../utils/log'); console.log(`${symbols.gen} Created folder ${normalize(genDir)}`); } catch { console.log(`[vuevn] generate: created folder ${genDir}`); }

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
        if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear} Merged npm plugin ${pkgName}`); } catch { console.log(`[vuevn] generate: merged npm plugin ${pkgName}`); } }
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
  // Build texts domain grouped under 'global' and 'location'
  function unwrapTextsRoot(node) {
    if (!node || typeof node !== 'object') return { files: [], dirs: {} };
    const dirNames = Object.keys(node.dirs || {});
    if ((node.files || []).length === 0 && dirNames.length === 1 && dirNames[0] === 'texts') {
      return node.dirs['texts'];
    }
    return node;
  }
  const textsTree = { files: [], dirs: {} };
  const gTxt = unwrapTextsRoot(globalTexts);
  const lTxt = unwrapTextsRoot(locationsTexts);
  if (gTxt && (Object.keys(gTxt.dirs || {}).length || (gTxt.files || []).length)) {
    textsTree.dirs['global'] = gTxt;
  }
  if (lTxt && (Object.keys(lTxt.dirs || {}).length || (lTxt.files || []).length)) {
    textsTree.dirs['location'] = lTxt;
  }

  const indexData = {
    note: "tree snapshot for generate rework PoC (agnostic, deep)",
    tree: mergedTree,
    domain: {
      global: globalNoText,
      location: locationsNoText,
      texts: textsTree,
    },
  };

  // Debug snapshot files (disabled for now)
  // const ts = `// Auto-generated: development tree snapshot. DO NOT EDIT.\n` +
  //            `export const tree = ${JSON.stringify(indexData, null, 2)} as const;\n`;
  // fs.writeFileSync(path.join(genDir, "index.ts"), ts, "utf8");
  // console.log("[vuevn] generate: wrote generate/index.ts (tree snapshot)");
  // function simplify(node) {
  //   return {
  //     files: (node.files || []).map(f => f.name),
  //     dirs: Object.fromEntries(
  //       Object.entries(node.dirs || {}).map(([k, v]) => [k, simplify(v)])
  //     ),
  //   };
  // }
  // const simple = simplify(mergedTree);
  // fs.writeFileSync(path.join(genDir, "tree.json"), JSON.stringify(simple, null, 2) + "\n", "utf8");
  // console.log("[vuevn] generate: wrote generate/tree.json (debug)");
  // const simpleDomain = { global: simplify(globalNoText), location: simplify(locationsNoText), texts: simplify(textsTree) };
  // fs.writeFileSync(path.join(genDir, "domain.json"), JSON.stringify(simpleDomain, null, 2) + "\n", "utf8");
  // console.log("[vuevn] generate: wrote generate/domain.json (debug)");

  // 4) Build overlay aggregators (engine/plugins)
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
        return { kind: 'npm', spec: normalize(path.posix.join(best.pkg, best.relPath)), rel: normalize(best.relPath) };
      }
    }
    const core = (foundFiles || []).find(ff => ff && (ff.source === 'engine'));
    if (core) {
      return { kind: 'engine', rel: normalize(core.relPath) };
    }
    return null;
  }

  function stripExt(p) { return p.replace(/\.(ts|vue)$/i, ""); }
  function isTypesPath(rel) { return !!rel && (rel === 'types' || rel.startsWith('types/') || rel.includes('/types/')); }
  function buildSpecFromPick(pick, ext) {
    let base;
    if (pick.kind === 'plugin') base = `@plugins/${pick.rel}`;
    else if (pick.kind === 'npm') base = pick.spec;
    else if (pick.kind === 'engine') base = `@vuevn/engine_src/${pick.rel}`;
    return (ext === '.vue') ? base : stripExt(base);
  }

  function writeIndexForNode(node, relDirParts) {
    const outDir = path.join(outEngineRoot, ...relDirParts);
    const lines = [];
    
    // Export direct files in this directory
    for (const f of (node.files || [])) {
      const pick = chooseSource(f.found_files || []);
      if (!pick) continue;
      const symbol = f.name; // Convention: default export aliased by filename
      const spec = buildSpecFromPick(pick, f.ext);
      const underTypes = isTypesPath(pick.rel || '');
      if (underTypes) {
        // Types: export type-only to avoid value import
        lines.push(`export type * from '${spec}';`);
      } else {
        // Keep .vue extension in spec; strip .ts
        lines.push(`export { default as ${symbol} } from '${spec}';`);
      }
    }
    
    // Also re-export from subdirectories (for Main.vue to be available in root index)
    const subDirs = Object.keys(node.dirs || {}).sort();
    for (const sub of subDirs) {
      lines.push(`export * from './${sub}';`);
    }
    
    if (lines.length > 0) {
      ensureDir(outDir);
      const indexPath = path.join(outDir, "index.ts");
      fs.writeFileSync(indexPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
      if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote ${normalize(path.relative(projectRoot, indexPath))}`); } catch { console.log(`[vuevn] generate: wrote ${normalize(path.relative(projectRoot, indexPath))}`); } }
    }

    for (const [sub, child] of Object.entries(node.dirs || {})) {
      writeIndexForNode(child, [...relDirParts, sub]);
    }
  }

  writeIndexForNode(mergedTree, []);
  // Write project structure (global/locations/project.ts)
  writeProjectStructure({ projectRoot, outDir: genDir, verbose });
  // Also write texts folder tree for runtime/editor
  writeTextsTree({ projectRoot, outDir: genDir, verbose });
}

function readLangModule(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const m = src.match(/export\s+default\s*([\s\S]*?)\s*as\s+const\s*;?\s*$/);
  const m2 = m || src.match(/export\s+default\s*([\s\S]*?);?\s*$/);
  if (!m2) return {};
  const objSrc = m2[1];
  try {
    const val = new Function(`return (${objSrc})`)();
    if (val && typeof val === 'object') return val;
  } catch {}
  return {};
}

function escapeString(v) { return JSON.stringify(String(v)); }

function writeFileIfChanged(filePath, content) {
  ensureDir(path.dirname(filePath));
  let prev = null;
  try { prev = fs.readFileSync(filePath, 'utf8'); } catch {}
  if (prev !== content) fs.writeFileSync(filePath, content, 'utf8');
}

function writeTextsTree({ projectRoot, outDir, verbose }) {
  const ignore = ["**/node_modules/**", "**/.git/**", "**/.vite/**", "**/.vuevn_tmp/**", "**/dist/**", "**/generate/**", "**/.*"];
  const outRoot = path.join(outDir, 'texts');
  if (fse.pathExistsSync(outRoot)) fse.removeSync(outRoot);
  ensureDir(outRoot);

  // Global scopes
  const globalScopes = new Map();
  const gFiles = fg.sync('global/texts/**/*.ts', { cwd: projectRoot, ignore, onlyFiles: true });
  for (const rel of gFiles) {
    const abs = path.join(projectRoot, rel);
    const parts = normalize(rel).split('/');
    const lang = parts.pop().replace(/\.ts$/i, '').toLowerCase();
    parts.shift(); // global
    parts.shift(); // texts
    const scopePath = parts.join('/');
    if (!scopePath) continue;
    const langObj = readLangModule(abs);
    const map = globalScopes.get(scopePath) || new Map();
    map.set(lang, langObj);
    globalScopes.set(scopePath, map);
  }

  // Location texts
  const locMap = new Map();
  const lFiles = fg.sync('locations/**/texts/**/*.ts', { cwd: projectRoot, ignore, onlyFiles: true });
  for (const rel of lFiles) {
    const abs = path.join(projectRoot, rel);
    const parts = normalize(rel).split('/');
    if (parts[0] !== 'locations') continue;
    const locId = parts[1];
    const idxTexts = parts.indexOf('texts');
    if (idxTexts < 0) continue;
    const lang = parts[parts.length - 1].replace(/\.ts$/i, '').toLowerCase();
    const scopePath = parts.slice(idxTexts + 1, parts.length - 1).join('/');
    const langObj = readLangModule(abs);
    let loc = locMap.get(locId);
    if (!loc) { loc = new Map(); locMap.set(locId, loc); }
    const scope = loc.get(scopePath) || new Map();
    scope.set(lang, langObj);
    loc.set(scopePath, scope);
  }

  // Determine language set strictly from config.ts
  const langsFromConfig2 = extractLanguagesFromConfig(projectRoot);
  if (!langsFromConfig2 || langsFromConfig2.length === 0) {
    throw new Error("[vuevn] No languages declared in config.ts. Define languages: [{ code: 'en', name: 'English', default: true }, ...]");
  }
  const langs = langsFromConfig2.slice().sort();


  // Write global leaves and index
  const gIndexImports = [];
  const gIndexEntries = [];
  for (const [scopePath, langMap] of Array.from(globalScopes.entries()).sort()) {
    const allKeys = new Set();
    for (const obj of langMap.values()) for (const k of Object.keys(obj || {})) allKeys.add(k);
    const keys = Array.from(allKeys).sort();
    const lines = [];
    lines.push(`// Generated text objects for global/${scopePath}`);
    lines.push(`export const texts = {`);
    lines.push(`  __path: "",`);
    for (const k of keys) {
      lines.push(`  ${k}: {`);
      lines.push(`    __key: ${escapeString(k)},`);
      for (const lang of langs) {
        const obj = langMap.get(lang);
        const val = obj ? obj[k] : undefined;
        if (typeof val === 'string' && val.length > 0) {
          lines.push(`    ${lang}: ${escapeString(val)},`);
        } else {
          lines.push(`    ${lang}: null,`);
        }
      }
      lines.push(`  },`);
    }
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default texts;`);
    const leafOut = path.join(outRoot, 'global', scopePath, 'index.ts');
    writeFileIfChanged(leafOut, lines.join('\n'));
    const importVar = scopePath.split('/').slice(-1)[0] + 'Texts';
    const importPath = './' + scopePath;
    gIndexImports.push(`import ${importVar} from '${importPath}';`);
    gIndexEntries.push(`  ${scopePath.split('/').slice(-1)[0]}: ${importVar},`);
  }
  {
    const lines = [];
    lines.push(`// Generated global texts index`);
    lines.push(...gIndexImports);
    lines.push('');
    lines.push(`export const globalTexts = {`);
    lines.push(...gIndexEntries);
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default globalTexts;`);
    writeFileIfChanged(path.join(outRoot, 'global', 'index.ts'), lines.join('\n'));
  }

  // Write per-location leaves and indexes
  const locRootImports = [];
  const locRootEntries = [];
  for (const [locId, scopes] of Array.from(locMap.entries()).sort()) {
    const locIndexImports = [];
    const locIndexEntries = [];
    for (const [scopePath, langMap] of Array.from(scopes.entries()).sort()) {
      const allKeys = new Set();
      for (const obj of langMap.values()) for (const k of Object.keys(obj || {})) allKeys.add(k);
      const keys = Array.from(allKeys).sort();
      const lines = [];
      lines.push(`// Generated text objects for locations/${locId}${scopePath ? '/' + scopePath : ''}`);
      lines.push(`export const texts = {`);
      lines.push(`  __path: ${escapeString(scopePath)},`);
      for (const k of keys) {
        lines.push(`  ${k}: {`);
        lines.push(`    __key: ${escapeString(k)},`);
        for (const lang of langs) {
          const obj = langMap.get(lang);
          const val = obj ? obj[k] : undefined;
          if (typeof val === 'string' && val.length > 0) {
            lines.push(`    ${lang}: ${escapeString(val)},`);
          } else {
            lines.push(`    ${lang}: null,`);
          }
        }
        lines.push(`  },`);
      }
      lines.push(`} as const;`);
      lines.push('');
      lines.push(`export default texts;`);
      const leafOut = path.join(outRoot, 'locations', locId, scopePath, 'index.ts');
      writeFileIfChanged(leafOut, lines.join('\n'));
      const importPath = './' + (scopePath || '.');
      const alias = `texts_${locIndexImports.length}`;
      locIndexImports.push(`import ${alias} from '${importPath}';`);
      const prop = (scopePath || 'root').replace(/[\/]/g, '_');
      locIndexEntries.push(`  ${prop}: ${alias},`);
    }
    const lines = [];
    lines.push(`// Generated location texts index for ${locId}`);
    lines.push(...locIndexImports);
    lines.push('');
    const named = `${locId}Texts`;
    lines.push(`export const ${named} = {`);
    lines.push(...locIndexEntries);
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default ${named};`);
    writeFileIfChanged(path.join(outRoot, 'locations', locId, 'index.ts'), lines.join('\n'));
    locRootImports.push(`import { ${named} } from './${locId}';`);
    locRootEntries.push(`  ${locId}: ${named},`);
  }
  {
    const lines = [];
    lines.push(`// Generated locations main index`);
    lines.push(...locRootImports);
    lines.push('');
    lines.push(`export const locationTexts = {`);
    lines.push(...locRootEntries);
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default locationTexts;`);
    writeFileIfChanged(path.join(outRoot, 'locations', 'index.ts'), lines.join('\n'));
  }

  {
    const lines = [];
    lines.push(`// Generated text system main index`);
    lines.push(`import { globalTexts } from './global';`);
    lines.push(`import { locationTexts } from './locations';`);
    lines.push('');
    lines.push(`export const texts = {`);
    lines.push(`  global: globalTexts,`);
    lines.push(`  locations: locationTexts`);
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default texts;`);
    writeFileIfChanged(path.join(outRoot, 'index.ts'), lines.join('\n'));
  }

  if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote texts folder to ${normalize(path.relative(projectRoot, outRoot))}`); } catch { console.log(`[vuevn] generate: wrote texts folder to ${normalize(path.relative(projectRoot, outRoot))}`); } }
}

async function runGenerateTexts({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const genDir = path.join(projectRoot, 'generate');
  ensureDir(genDir);
  writeTextsTree({ projectRoot, outDir: genDir, verbose });
}

function writeProjectStructure({ projectRoot, outDir, verbose }) {
  const toPosix = (p) => normalize(p).replace(/^\//, '');
  // Helpers
  function listTs(base) {
    return fg.sync('**/*.ts', { cwd: base, onlyFiles: true, ignore: ['**/*.d.ts', '**/.*', '**/node_modules/**'] });
  }
  function importSpecFromProject(rel) {
    // rel is like 'global/actions/wait.ts' or 'locations/bedroom/events/x.ts'
    return `@project/${toPosix(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`;
  }
  function writeGlobal() {
    const gBase = path.join(projectRoot, 'global');
    const actionsDir = path.join(gBase, 'actions');
    const eventsDir = path.join(gBase, 'events');
    const gOutDir = path.join(outDir, 'global');
    ensureDir(gOutDir);

    // actions
    const actions = fse.pathExistsSync(actionsDir) ? listTs(actionsDir) : [];
    const aLines = [
      `// Generated actions for global location`,
      `import type { VNAction } from '@generate/types';`,
      '',
    ];
    const aImports = [];
    const aMap = [];
    const aPaths = [];
    for (const rel of actions.sort()) {
      const name = path.basename(rel, '.ts');
      const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const spec = importSpecFromProject(path.join('global', 'actions', rel));
      aLines.push(`import ${alias} from '${spec}';`);
      aMap.push(`  ${JSON.stringify(name)}: ${alias}`);
      aPaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
    }
    aLines.push('', `export const actionsList: Record<string, VNAction> = {`, aMap.join(',\n'), `};`, '', `export default actionsList;`, '', `export const actionsPaths: Record<string, string> = {`, aPaths.join(',\n'), `};`, '');
    writeFileIfChanged(path.join(gOutDir, 'actions.ts'), aLines.join('\n'));

    // events
    const events = fse.pathExistsSync(eventsDir) ? listTs(eventsDir) : [];
    const eLines = [
      `// Generated events for global location`,
      `import type { VNEvent } from '@generate/types';`,
      '',
    ];
    const eMap = [];
    const ePaths = [];
    for (const rel of events.sort()) {
      const name = path.basename(rel, '.ts');
      const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const spec = importSpecFromProject(path.join('global', 'events', rel));
      eLines.push(`import ${alias} from '${spec}';`);
      eMap.push(`  ${JSON.stringify(name)}: ${alias}`);
      ePaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
    }
    eLines.push('', `export const eventsList: Record<string, VNEvent> = {`, eMap.join(',\n'), `};`, '', `export default eventsList;`, '', `export const eventsPaths: Record<string, string> = {`, ePaths.join(',\n'), `};`, '');
    writeFileIfChanged(path.join(gOutDir, 'events.ts'), eLines.join('\n'));

    // index
    const idx = [];
    idx.push(`// Generated index for global location`);
    idx.push(`import type { LocationData } from '@generate/types';`);
    idx.push(`import { actionsList, actionsPaths } from './actions';`);
    idx.push(`import { eventsList, eventsPaths } from './events';`);
    idx.push('');
    idx.push(`const global: LocationData = {`);
    idx.push(`  id: "global",`);
    idx.push(`  actions: actionsList,`);
    idx.push(`  actionsPaths: actionsPaths,`);
    idx.push(`  events: eventsList,`);
    idx.push(`  eventsPaths: eventsPaths,`);
    idx.push(`  accessibles: {}`);
    idx.push(`};`);
    idx.push('');
    idx.push(`export default global;`);
    writeFileIfChanged(path.join(gOutDir, 'index.ts'), idx.join('\n'));

    // Verbose summary for global
    if (verbose) {
      try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear}  Global: ${actions.length} action(s), ${events.length} event(s)`); } catch { console.log(`[vuevn] Global: ${actions.length} actions, ${events.length} events`); }
    }
  }

  function writeLocations() {
    const locsDir = path.join(projectRoot, 'locations');
    if (!fse.pathExistsSync(locsDir)) return [];
    const locIds = fg.sync('*', { cwd: locsDir, onlyDirectories: true, deep: 1 });
    const list = [];
    let totalActions = 0, totalEvents = 0;
    for (const locId of locIds.sort()) {
      list.push(locId);
      const lBase = path.join(locsDir, locId);
      const lOut = path.join(outDir, 'locations', locId);
      ensureDir(lOut);

      // actions
      const actionsDir = path.join(lBase, 'actions');
      const actions = fse.pathExistsSync(actionsDir) ? listTs(actionsDir) : [];
      const aLines = [
        `// Generated actions for location: ${locId}`,
        `import type { VNAction } from '@generate/types';`,
        '',
      ];
      const aMap = [];
      const aPaths = [];
      for (const rel of actions.sort()) {
        const name = path.basename(rel, '.ts');
        const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
        const spec = importSpecFromProject(path.join('locations', locId, 'actions', rel));
        aLines.push(`import ${alias} from '${spec}';`);
        aMap.push(`  ${JSON.stringify(name)}: ${alias}`);
        aPaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
      }
      aLines.push('', `export const actionsList: Record<string, VNAction> = {`, aMap.join(',\n'), `};`, '', `export default actionsList;`, '', `export const actionsPaths: Record<string, string> = {`, aPaths.join(',\n'), `};`, '');
      writeFileIfChanged(path.join(lOut, 'actions.ts'), aLines.join('\n'));

      // events
      const eventsDir = path.join(lBase, 'events');
      const events = fse.pathExistsSync(eventsDir) ? listTs(eventsDir) : [];
      const eLines = [
        `// Generated events for location: ${locId}`,
        `import type { VNEvent } from '@generate/types';`,
        '',
      ];
      const eMap = [];
      const ePaths = [];
      for (const rel of events.sort()) {
        const name = path.basename(rel, '.ts');
        const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
        const spec = importSpecFromProject(path.join('locations', locId, 'events', rel));
        eLines.push(`import ${alias} from '${spec}';`);
        eMap.push(`  ${JSON.stringify(name)}: ${alias}`);
        ePaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
      }
      eLines.push('', `export const eventsList: Record<string, VNEvent> = {`, eMap.join(',\n'), `};`, '', `export default eventsList;`, '', `export const eventsPaths: Record<string, string> = {`, ePaths.join(',\n'), `};`, '');
      writeFileIfChanged(path.join(lOut, 'events.ts'), eLines.join('\n'));

      // index
      const iLines = [];
      iLines.push(`// Generated index for location: ${locId}`);
      iLines.push(`import type { LocationData } from '@generate/types';`);
      // optional info
      const infoPath = path.join(lBase, 'info.ts');
      if (fse.pathExistsSync(infoPath)) {
        iLines.push(`import info from '@project/locations/${locId}/info';`);
      }
      iLines.push(`import { actionsList, actionsPaths } from './actions';`);
      iLines.push(`import { eventsList, eventsPaths } from './events';`);
      iLines.push('');
      iLines.push(`const ${locId}: LocationData = {`);
      iLines.push(`  id: ${JSON.stringify(locId)},`);
      if (fse.pathExistsSync(infoPath)) iLines.push(`  info,`);
      iLines.push(`  actions: actionsList,`);
      iLines.push(`  actionsPaths: actionsPaths,`);
      iLines.push(`  events: eventsList,`);
      iLines.push(`  eventsPaths: eventsPaths,`);
      iLines.push(`  accessibles: {}`);
      iLines.push(`};`);
      iLines.push('');
      iLines.push(`export default ${locId};`);
      writeFileIfChanged(path.join(lOut, 'index.ts'), iLines.join('\n'));

      // Verbose per-location summary
      totalActions += actions.length; totalEvents += events.length;
      if (verbose) {
        try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear}  Location ${locId}: ${actions.length} action(s), ${events.length} event(s)`); } catch { console.log(`[vuevn] Location ${locId}: ${actions.length} actions, ${events.length} events`); }
      }
    }
    return list;
  }

  function writeProject() {
    const out = [];
    out.push(`// Generated project data index`);
    out.push(`import config from '@project/config';`);
    out.push(`import type { LocationData, ProjectData } from '@generate/types';`);
    const locIds = fg.sync('*', { cwd: path.join(projectRoot, 'locations'), onlyDirectories: true, deep: 1 }).sort();
    for (const locId of locIds) {
      out.push(`import ${locId} from './locations/${locId}';`);
    }
    out.push(`import global from './global';`);
    out.push('');
    out.push(`const locations: Record<string, LocationData> = {`);
    for (const locId of locIds) out.push(`  ${JSON.stringify(locId)}: ${locId},`);
    out.push(`};`);
    out.push('');
    const projectId = path.basename(projectRoot);
    out.push(`const projectData: ProjectData = {`);
    out.push(`  project_id: ${JSON.stringify(projectId)},`);
    out.push(`  config: config(),`);
    out.push(`  locations: locations,`);
    out.push(`  global: global`);
    out.push(`};`);
    out.push('');
    out.push(`export default projectData;`);
    writeFileIfChanged(path.join(outDir, 'project.ts'), out.join('\n'));
  }

  writeGlobal();
  const locList = writeLocations();
  writeProject();
  if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote project structure under ${normalize(path.relative(projectRoot, outDir))}`); } catch { console.log(`[vuevn] generate: wrote project structure under ${normalize(path.relative(projectRoot, outDir))}`); } }
}

async function runGenerateEngine({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const cliRoot = path.resolve(__dirname, "../..");
  const genDir = path.join(projectRoot, "generate");
  ensureDir(genDir);

  // engine+plugins merge
  const engineBase = path.join(cliRoot, "engine_src");
  const engineTree = buildTree(engineBase, engineBase, "engine");
  const pluginTree = buildTree(path.join(projectRoot, "plugins"), path.join(projectRoot, "plugins"), "plugin");
  let mergedTree = mergeTrees(engineTree, pluginTree);
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
      } catch {}
    }
  }

  // Verbose: print counts based on discovered trees (no filesystem walkers)
  if (verbose) {
    try {
      const { symbols } = require('../utils/log');
      function collectFiles(node, base = '') {
        const out = [];
        if (!node) return out;
        for (const f of (node.files || [])) out.push(base + f.name + f.ext);
        for (const [dir, child] of Object.entries(node.dirs || {})) {
          out.push(...collectFiles(child, base + dir + '/'));
        }
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
  function writeIndexForNode(node, relDirParts) {
    const outDir = path.join(genDir, ...relDirParts);
    const lines = [];
    for (const f of (node.files || [])) {
      const pick = (function choose(foundFiles){
        const local = (foundFiles || []).find(ff => ff && (ff.source === 'plugin'));
        if (local) return { kind: 'plugin', rel: normalize(local.relPath) };
        if (pluginNames && pluginNames.length) {
          let best = null; for (const name of pluginNames) { const hit = (foundFiles || []).find(ff => ff && ff.source === 'npm-plugin' && ff.pkg === name); if (hit) { best = hit; break; } }
          if (best) return { kind: 'npm', spec: normalize(path.posix.join(best.pkg, best.relPath)), rel: normalize(best.relPath) };
        }
        const core = (foundFiles || []).find(ff => ff && (ff.source === 'engine'));
        if (core) return { kind: 'engine', rel: normalize(core.relPath) };
        return null;
      })(f.found_files || []);
      if (!pick) continue;
      const symbol = f.name;
      let base; if (pick.kind === 'plugin') base = `@plugins/${pick.rel}`; else if (pick.kind === 'npm') base = pick.spec; else base = `@vuevn/engine_src/${pick.rel}`;
      const spec = (f.ext === '.vue') ? base : base.replace(/\.(ts|vue)$/i, '');
      const underTypes = !!(pick.rel && (pick.rel === 'types' || pick.rel.startsWith('types/') || pick.rel.includes('/types/')));
      if (underTypes) lines.push(`export type * from '${spec}';`); else lines.push(`export { default as ${symbol} } from '${spec}';`);
    }
    if (lines.length > 0) { ensureDir(outDir); writeFileIfChanged(path.join(outDir, 'index.ts'), lines.join('\n') + '\n'); }
    for (const [sub, child] of Object.entries(node.dirs || {})) writeIndexForNode(child, [...relDirParts, sub]);
  }
  writeIndexForNode(mergedTree, []);
  if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote engine overlay under ${normalize(path.relative(projectRoot, genDir))}`); } catch { console.log(`[vuevn] generate: wrote engine overlay under ${normalize(path.relative(projectRoot, genDir))}`); } }
}

// Asset index generation moved to separate module  
const { generateAssetsIndex } = require('./assetIndexGenerator');

async function runGenerateProject({ projectRoot, verbose }) {
  await ensureDeps(projectRoot);
  const genDir = path.join(projectRoot, 'generate');
  ensureDir(genDir);
  writeProjectStructure({ projectRoot, outDir: genDir, verbose });
  generateAssetsIndex({ projectRoot, outDir: genDir, verbose });
}

module.exports = { runGenerate, runGenerateTexts, runGenerateEngine, runGenerateProject, extractLanguagesFromConfig };
