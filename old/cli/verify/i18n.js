"use strict";

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const { createRequire } = require("module");
const { extractLanguagesFromConfig } = require("../generate/index");

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
    const cliPkg = reqFromProject.resolve('@crimsonquill/cli/package.json');
    const reqCli = createRequire(cliPkg);
    return reqCli(mod);
  } catch {}
  return null;
}

function loadTsDefaultObject(absPath, projectRoot) {
  // Prefer TS transpile; fallback to regex if TS not available
  try {
    const ts = requireFromProject('typescript', projectRoot) || requireFromCliInstall('typescript', projectRoot);
    if (ts && ts.transpileModule) {
      const src = fs.readFileSync(absPath, 'utf8');
      const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } });
      const code = out.outputText;
      const req = createRequire(path.join(projectRoot, 'package.json'));
      const moduleShim = { exports: {} };
      const fn = new Function('require', 'module', 'exports', code);
      fn(req, moduleShim, moduleShim.exports);
      const mod = moduleShim.exports;
      const value = (mod && typeof mod.default !== 'undefined') ? mod.default : mod;
      if (value && typeof value === 'object') return value;
    }
  } catch {}
  // Fallback: best-effort regex parse of exported default object
  try {
    const src = fs.readFileSync(absPath, 'utf8');
    const m = src.match(/export\s+default\s*([\s\S]*?)\s*(?:as\s+const)?\s*;?\s*$/);
    if (!m) return {};
    const objSrc = m[1];
    const val = new Function(`return (${objSrc})`)();
    if (val && typeof val === 'object') return val;
  } catch {}
  return {};
}

function collectIssuesForBase(baseDir, languages, { domain, location }, projectRoot) {
  const issues = [];
  if (!fs.existsSync(baseDir)) return issues;
  const files = fg.sync("**/*.ts", { cwd: baseDir, onlyFiles: true, dot: false });
  const scopeUnion = {};
  const scopeLangKeys = {};
  for (const rel of files) {
    const parts = rel.replace(/\\/g, "/").split("/");
    const langFile = parts[parts.length - 1];
    const lang = langFile.replace(/\.ts$/i, "").toLowerCase();
    const scope = parts.slice(0, parts.length - 1).join("/");
    const abs = path.join(baseDir, rel);
    const obj = loadTsDefaultObject(abs, projectRoot);
    const keys = new Set(Object.keys(obj || {}));
    if (!scopeUnion[scope]) scopeUnion[scope] = new Set();
    for (const k of keys) scopeUnion[scope].add(k);
    if (!scopeLangKeys[scope]) scopeLangKeys[scope] = {};
    scopeLangKeys[scope][lang] = keys;
  }
  for (const [scope, unionSet] of Object.entries(scopeUnion)) {
    const allKeys = Array.from(unionSet);
    for (const lang of languages) {
      const present = (scopeLangKeys[scope] && scopeLangKeys[scope][lang]) || new Set();
      for (const k of allKeys) {
        if (!present.has(k)) {
          issues.push(domain === 'global' ? { domain, scope, lang, key: k } : { domain, location, scope, lang, key: k });
        }
      }
    }
  }
  return issues;
}

async function verifyI18n({ projectRoot, ignoreTranslations = false, verbose = false }) {
  const langs = extractLanguagesFromConfig(projectRoot);
  if (!langs || langs.length === 0) {
    throw new Error("No languages declared in config.ts. Define languages: [{ code: 'en', name: 'English', default: true }, ...]");
  }
  const languages = langs.map((l) => String(l).toLowerCase());

  const globalBase = path.join(projectRoot, 'global', 'texts');
  const globalIssues = collectIssuesForBase(globalBase, languages, { domain: 'global' }, projectRoot);

  const locIssues = [];
  const locsRoot = path.join(projectRoot, 'locations');
  if (fs.existsSync(locsRoot)) {
    const locIds = fg.sync('*', { cwd: locsRoot, onlyDirectories: true, dot: false });
    for (const locId of locIds) {
      const locBase = path.join(locsRoot, locId, 'texts');
      locIssues.push(...collectIssuesForBase(locBase, languages, { domain: 'location', location: locId }, projectRoot));
    }
  }

  const issues = [...globalIssues, ...locIssues];
  if (verbose) {
    if (issues.length) {
      console.log(`[vuevn] i18n: missing ${issues.length} key(s)`);
      const preview = issues.slice(0, 20);
      for (const it of preview) {
        if (it.domain === 'global') {
          console.log(`  - [global] scope='${it.scope || '.'}' lang='${it.lang}' key='${it.key}'`);
        } else {
          console.log(`  - [${it.location}] scope='${it.scope || '.'}' lang='${it.lang}' key='${it.key}'`);
        }
      }
      if (issues.length > preview.length) console.log(`  ... (${issues.length - preview.length} more)`);
    } else {
      console.log(`[vuevn] i18n: OK (no missing keys)`);
    }
  }

  return {
    success: ignoreTranslations || issues.length === 0,
    ignored: ignoreTranslations && issues.length > 0,
    count: issues.length,
    issues,
  };
}

module.exports = { verifyI18n };
