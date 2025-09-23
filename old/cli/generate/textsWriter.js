"use strict";

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const { ensureDir, writeFileIfChanged, normalize } = require("./utils");

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

function escapeString(v) { return JSON.stringify(String(v)
  .replace(/\\n/g, '\\n')
  .replace(/\r/g, '')
  .replace(/`/g, '\\`')) }

function writeTextsTree({ projectRoot, outDir, verbose }) {
  const outRoot = path.join(outDir, 'texts');
  ensureDir(outRoot);

  function collectLangs(baseDir) {
    if (!fs.existsSync(baseDir)) return { langs: [], keys: new Set(), perLang: new Map() };
    const files = fg.sync('*.ts', { cwd: baseDir, onlyFiles: true, dot: false });
    const langs = files.map(f => f.replace(/\.ts$/i, '').toLowerCase()).sort();
    const perLang = new Map();
    const keyUnion = new Set();
    for (const lang of langs) {
      const obj = readLangModule(path.join(baseDir, `${lang}.ts`));
      const keys = Object.keys(obj || {});
      perLang.set(lang, obj);
      for (const k of keys) keyUnion.add(k);
    }
    return { langs, keys: keyUnion, perLang };
  }

  // Global texts
  const globalTextsDir = path.join(projectRoot, 'global', 'texts');
  const globalScopes = fg.sync('**/', { cwd: globalTextsDir, onlyDirectories: true, dot: false });
  const gIndexImports = [];
  const gIndexEntries = [];
  for (const scopeRel of globalScopes) {
    const scopePath = scopeRel.replace(/\/$/, '');
    if (!scopePath) continue;
    const base = path.join(globalTextsDir, scopePath);
    const { langs, keys, perLang } = collectLangs(base);
    const keysArr = Array.from(keys).sort();
    const lines = [];
    lines.push(`// Generated text objects for global/${scopePath}`);
    lines.push(`export const texts = {`);
    lines.push(`  __path: ${escapeString(scopePath)},`);
    for (const k of keysArr) {
      lines.push(`  ${k}: {`);
      lines.push(`    __key: ${escapeString(k)},`);
      for (const lang of langs) {
        const obj = perLang.get(lang);
        const val = obj ? obj[k] : undefined;
        if (typeof val === 'string' && val.length > 0) lines.push(`    ${lang}: ${escapeString(val)},`);
        else lines.push(`    ${lang}: null,`);
      }
      lines.push(`  },`);
    }
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default texts;`);
    const leafOut = path.join(outRoot, 'global', scopePath, 'index.ts');
    writeFileIfChanged(leafOut, lines.join('\n'));
    const importPath = './' + (scopePath || '.');
    const alias = `texts_${gIndexImports.length}`;
    gIndexImports.push(`import ${alias} from '${importPath}';`);
    const prop = (scopePath || 'root').replace(/[\/]/g, '_');
    gIndexEntries.push(`  ${prop}: ${alias},`);
  }
  {
    const lines = [];
    lines.push(`// Generated global texts main index`);
    lines.push(...gIndexImports);
    lines.push('');
    lines.push(`export const globalTexts = {`);
    lines.push(...gIndexEntries);
    lines.push(`} as const;`);
    lines.push('');
    lines.push(`export default globalTexts;`);
    writeFileIfChanged(path.join(outRoot, 'global', 'index.ts'), lines.join('\n'));
  }

  // Location texts
  const locsDir = path.join(projectRoot, 'locations');
  const locIds = fs.existsSync(locsDir) ? fg.sync('*', { cwd: locsDir, onlyDirectories: true, dot: false }) : [];
  const locRootImports = [];
  const locRootEntries = [];
  for (const locId of locIds) {
    const baseDir = path.join(locsDir, locId, 'texts');
    if (!fs.existsSync(baseDir)) continue;
    const scopes = fg.sync('**/', { cwd: baseDir, onlyDirectories: true, dot: false });
    const locIndexImports = [];
    const locIndexEntries = [];
    for (const scopeRel of scopes) {
      const scopePath = scopeRel.replace(/\/$/, '');
      const tgt = path.join(baseDir, scopePath);
      const { langs, keys, perLang } = collectLangs(tgt);
      const keysArr = Array.from(keys).sort();
      const lines = [];
      lines.push(`// Generated text objects for locations/${locId}${scopePath ? '/' + scopePath : ''}`);
      lines.push(`export const texts = {`);
      lines.push(`  __path: ${escapeString(scopePath)},`);
      for (const k of keysArr) {
        lines.push(`  ${k}: {`);
        lines.push(`    __key: ${escapeString(k)},`);
        for (const lang of langs) {
          const obj = perLang.get(lang);
          const val = obj ? obj[k] : undefined;
          if (typeof val === 'string' && val.length > 0) lines.push(`    ${lang}: ${escapeString(val)},`);
          else lines.push(`    ${lang}: null,`);
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

module.exports = { writeTextsTree };

