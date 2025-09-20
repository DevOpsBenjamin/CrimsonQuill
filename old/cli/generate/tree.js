"use strict";

const path = require("path");
const fg = require("fast-glob");
const fse = require("fs-extra");
const { normalize } = require("./utils");

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
  const dirNames = new Set([...(engineNode.dirs ? Object.keys(engineNode.dirs) : []), ...(pluginNode.dirs ? Object.keys(pluginNode.dirs) : [])]);
  for (const name of dirNames) {
    const e = (engineNode.dirs && engineNode.dirs[name]) || { files: [], dirs: {} };
    const p = (pluginNode.dirs && pluginNode.dirs[name]) || { files: [], dirs: {} };
    out.dirs[name] = mergeTrees(e, p);
  }
  return out;
}

module.exports = { createTreeFromPaths, buildTree, mergeTrees };

