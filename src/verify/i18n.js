"use strict";

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const { extractLanguagesFromConfig } = require("../generate/index");

function stripComments(src) {
  // remove /* */ and // comments
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function parseKeysFromTsObject(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const src = stripComments(raw);
    const keys = new Set();
    const empty = new Set();
    // naive match of key: "value" or 'value'
    const re = /\b([A-Za-z0-9_]+)\s*:\s*(["'])([\s\S]*?)\2\s*,?/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const k = m[1];
      const v = m[3];
      keys.add(k);
      if (!v || String(v).trim().length === 0) empty.add(k);
    }
    return { keys, empty };
  } catch {
    return { keys: new Set(), empty: new Set() };
  }
}

function mapPush(map, key, value) {
  if (!map[key]) map[key] = [];
  map[key].push(value);
}

function verifyGlobalTexts(projectRoot, languages) {
  const issues = [];
  const base = path.join(projectRoot, "global", "texts");
  const files = fg.sync("**/*.ts", { cwd: base, onlyFiles: true, dot: false });
  // Build scope -> union keys
  const scopeUnion = {};
  const scopeLangKeys = {}; // scope -> lang -> Set
  for (const rel of files) {
    const parts = rel.replace(/\\/g, "/").split("/");
    const langFile = parts[parts.length - 1];
    const lang = langFile.replace(/\.ts$/i, "").toLowerCase();
    const scope = parts.slice(0, parts.length - 1).join("/");
    const { keys } = parseKeysFromTsObject(path.join(base, rel));
    if (!scopeUnion[scope]) scopeUnion[scope] = new Set();
    for (const k of keys) scopeUnion[scope].add(k);
    if (!scopeLangKeys[scope]) scopeLangKeys[scope] = {};
    scopeLangKeys[scope][lang] = keys;
  }
  // Evaluate missing per language
  for (const [scope, unionSet] of Object.entries(scopeUnion)) {
    const allKeys = Array.from(unionSet);
    for (const lang of languages) {
      const present = (scopeLangKeys[scope] && scopeLangKeys[scope][lang]) || new Set();
      for (const k of allKeys) {
        if (!present.has(k)) {
          issues.push({ domain: "global", scope, lang, key: k });
        }
      }
    }
  }
  return issues;
}

function verifyLocationTexts(projectRoot, languages) {
  const issues = [];
  const locsDir = path.join(projectRoot, "locations");
  if (!fs.existsSync(locsDir)) return issues;
  const locIds = fg.sync("*", { cwd: locsDir, onlyDirectories: true, dot: false });
  for (const locId of locIds) {
    const base = path.join(locsDir, locId, "texts");
    if (!fs.existsSync(base)) continue;
    const files = fg.sync("**/*.ts", { cwd: base, onlyFiles: true, dot: false });
    const scopeUnion = {};
    const scopeLangKeys = {};
    for (const rel of files) {
      const parts = rel.replace(/\\/g, "/").split("/");
      const langFile = parts[parts.length - 1];
      const lang = langFile.replace(/\.ts$/i, "").toLowerCase();
      const scope = parts.slice(0, parts.length - 1).join("/");
      const { keys } = parseKeysFromTsObject(path.join(base, rel));
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
            issues.push({ domain: "location", location: locId, scope, lang, key: k });
          }
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
  const globalIssues = verifyGlobalTexts(projectRoot, languages);
  const locIssues = verifyLocationTexts(projectRoot, languages);
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

