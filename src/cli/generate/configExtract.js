"use strict";

const path = require("path");
const { createRequire } = require("module");
const fse = require("fs-extra");

function requireFromProject(mod, projectRoot) {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req(mod);
  } catch {}
  return null;
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

module.exports = { extractPluginsFromConfig, extractLanguagesFromConfig };

