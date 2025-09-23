"use strict";

const path = require("path");
const { scanProjectAssets } = require("./assetScanner");
const { writeFileIfChanged } = require("./utils");

/**
 * Generates TypeScript index file for project assets
 */
function generateAssetsIndex({ projectRoot, outDir, verbose }) {
  const assetsOutPath = path.join(outDir, 'assets.ts');
  const assets = scanProjectAssets(projectRoot);
  
  const lines = [
    '// Generated assets index',
    '// Provides type-safe access to project assets',
    '',
    'export interface AssetPaths {',
  ];

  let hasAssets = false;

  // Global assets interface
  if (assets.global.files && assets.global.files.length > 0) {
    lines.push('  global: {');
    for (const file of assets.global.files) {
      const assetPath = `global/${file.name}${file.ext}`;
      lines.push(`    '${file.name}': '${assetPath}';`);
      hasAssets = true;
    }
    lines.push('  };');
  }

  // Location assets interfaces
  for (const [location, locationAssets] of Object.entries(assets.locations)) {
    if (locationAssets.files && locationAssets.files.length > 0) {
      lines.push(`  ${location}: {`);
      for (const file of locationAssets.files) {
        const assetPath = `${location}/${file.name}${file.ext}`;
        lines.push(`    '${file.name}': '${assetPath}';`);
        hasAssets = true;
      }
      lines.push('  };');
    }
  }

  lines.push('}');
  lines.push('');

  // Generate runtime asset paths object
  lines.push('export const assetPaths: AssetPaths = {');
  
  // Global assets object
  if (assets.global.files && assets.global.files.length > 0) {
    lines.push('  global: {');
    for (const file of assets.global.files) {
      const assetPath = `global/${file.name}${file.ext}`;
      lines.push(`    '${file.name}': '${assetPath}',`);
    }
    lines.push('  },');
  }

  // Location assets objects
  for (const [location, locationAssets] of Object.entries(assets.locations)) {
    if (locationAssets.files && locationAssets.files.length > 0) {
      lines.push(`  ${location}: {`);
      for (const file of locationAssets.files) {
        const assetPath = `${location}/${file.name}${file.ext}`;
        lines.push(`    '${file.name}': '${assetPath}',`);
      }
      lines.push('  },');
    }
  }

  lines.push('};');
  lines.push('');
  lines.push('export default assetPaths;');

  if (hasAssets) {
    writeFileIfChanged(assetsOutPath, lines.join('\n') + '\n');
    if (verbose) {
      try { 
        const { symbols } = require('../utils/log'); 
        console.log(`${symbols.done} Generated assets index at ${path.relative(projectRoot, assetsOutPath)}`); 
      } catch { 
        console.log(`[vuevn] generate: wrote ${path.relative(projectRoot, assetsOutPath)}`); 
      }
    }
  } else {
    // Remove assets file if no assets found
    if (require('fs-extra').pathExistsSync(assetsOutPath)) {
      require('fs-extra').removeSync(assetsOutPath);
    }
  }

  return hasAssets;
}

module.exports = { generateAssetsIndex };