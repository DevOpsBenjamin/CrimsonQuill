"use strict";

const fs = require("fs");
const path = require("path");
const { writeFileIfChanged, ensureDir, normalize } = require("./utils");

function isTypesPath(rel) {
  return !!rel && (rel === 'types' || rel.startsWith('types/') || rel.includes('/types/'));
}

function chooseSource(foundFiles, pluginNames) {
  const local = (foundFiles || []).find(ff => ff && (ff.source === 'plugin'));
  if (local) return { kind: 'plugin', rel: normalize(local.relPath) };
  if (pluginNames && pluginNames.length) {
    let best = null;
    for (const name of pluginNames) {
      const hit = (foundFiles || []).find(ff => ff && ff.source === 'npm-plugin' && ff.pkg === name);
      if (hit) { best = hit; break; }
    }
    if (best) return { kind: 'npm', spec: normalize(path.posix.join(best.pkg, best.relPath)), rel: normalize(best.relPath) };
  }
  const core = (foundFiles || []).find(ff => ff && (ff.source === 'engine'));
  if (core) return { kind: 'engine', rel: normalize(core.relPath) };
  return null;
}

function buildSpecFromPick(pick, ext) {
  let base;
  if (pick.kind === 'plugin') base = `@plugins/${pick.rel}`;
  else if (pick.kind === 'npm') base = pick.spec;
  else base = `@crimsonquill/engine_src/${pick.rel}`;
  return (ext === '.vue') ? base : base.replace(/\.(ts|vue)$/i, '');
}

function writeOverlayFromTree({ mergedTree, outRootDir, pluginNames = [], verbose = false, projectRoot }) {
  ensureDir(outRootDir);
  function writeIndexForNode(node, relDirParts) {
    const outDir = path.join(outRootDir, ...relDirParts);
    const lines = [];
    for (const f of (node.files || [])) {
      const pick = chooseSource(f.found_files || [], pluginNames);
      if (!pick) continue;
      const symbol = f.name;
      const spec = buildSpecFromPick(pick, f.ext);
      const underTypes = isTypesPath(pick.rel || '');
      if (underTypes) lines.push(`export type * from '${spec}';`);
      else lines.push(`export { default as ${symbol} } from '${spec}';`);
    }
    if (lines.length > 0) {
      ensureDir(outDir);
      const indexPath = path.join(outDir, 'index.ts');
      writeFileIfChanged(indexPath, lines.join('\n') + '\n');
      if (verbose) {
        try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote ${normalize(path.relative(projectRoot, indexPath))}`); }
        catch { console.log(`[vuevn] generate: wrote ${normalize(path.relative(projectRoot, indexPath))}`); }
      }
    }
    for (const [sub, child] of Object.entries(node.dirs || {})) writeIndexForNode(child, [...relDirParts, sub]);
  }
  writeIndexForNode(mergedTree, []);
}

module.exports = { writeOverlayFromTree };
