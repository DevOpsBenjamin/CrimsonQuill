"use strict";

const fg = require("fast-glob");
const fse = require("fs-extra");
const path = require("path");

function toPosix(p) { 
  return p.replace(/\\/g, '/'); 
}

/**
 * Scans for asset files in a directory
 * Returns a tree structure with files and directories
 */
function buildAssetTree(dir, baseDir, sourceTag) {
  const assetPatterns = ["**/*.{png,jpg,jpeg,gif,webp,svg,mp3,wav,ogg,mp4,webm}"];
  const ignore = ["**/node_modules/**", "**/.git/**", "**/.vite/**", "**/.vuevn_tmp/**", "**/dist/**", "**/generate/**", "**/.*"];
  
  if (!fse.pathExistsSync(dir)) {
    return { files: [], dirs: {} };
  }
  
  const cwd = dir;
  const entries = fg.sync(assetPatterns, { cwd, dot: false, ignore, onlyFiles: true, followSymbolicLinks: true });
  
  return createTreeFromPaths(baseDir, entries, sourceTag);
}

/**
 * Creates a tree structure from file paths
 */
function createTreeFromPaths(baseDir, entries, sourceTag) {
  const root = { files: [], dirs: {} };
  
  for (const entry of entries) {
    const parts = entry.split('/');
    const fileName = parts.pop();
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    const relPath = toPosix(path.relative(baseDir, path.join(baseDir, entry)));
    
    let current = root;
    for (const part of parts) {
      if (!current.dirs[part]) {
        current.dirs[part] = { files: [], dirs: {} };
      }
      current = current.dirs[part];
    }
    
    current.files.push({
      name,
      ext,
      found_files: [{ source: sourceTag, relPath }]
    });
  }
  
  return root;
}

/**
 * Scans project for all assets and returns organized structure
 */
function scanProjectAssets(projectRoot) {
  const assets = {
    global: { files: [], dirs: {} },
    locations: {}
  };
  
  // Scan global assets
  const globalAssetsPath = path.join(projectRoot, 'global');
  if (fse.pathExistsSync(globalAssetsPath)) {
    assets.global = buildAssetTree(globalAssetsPath, globalAssetsPath, 'global');
  }
  
  // Scan location assets
  const locationsPath = path.join(projectRoot, 'locations');
  if (fse.pathExistsSync(locationsPath)) {
    const locations = fg.sync('*', { cwd: locationsPath, onlyDirectories: true, deep: 1 });
    
    for (const location of locations) {
      const locationPath = path.join(locationsPath, location);
      assets.locations[location] = buildAssetTree(locationPath, locationPath, location);
    }
  }
  
  return assets;
}

module.exports = {
  buildAssetTree,
  scanProjectAssets,
  createTreeFromPaths
};