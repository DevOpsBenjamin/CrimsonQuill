"use strict";

const fs = require("fs");
const path = require("path");
const fsExtra = require("fs-extra");

function toPosix(p) { return p.replace(/\\/g, '/'); }

/**
 * Copy project assets to the build output directory
 * Mirrors the structure from VueVN original copy-assets.cts
 */
async function copyProjectAssets({ projectRoot, outDir, verbose = false }) {
  if (verbose) {
    console.log(`🖨️  Copying assets for project: ${path.basename(projectRoot)}`);
  }

  // Ensure output directory exists  
  const publicDir = outDir; // Assets directly in dist/, not dist/assets/
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  let assetsCopied = false;

  // Copy global assets to assets/global/
  const globalAssetsPath = path.join(projectRoot, 'global');
  if (fs.existsSync(globalAssetsPath)) {
    const globalImagesPath = path.join(globalAssetsPath, 'images');
    const globalSoundsPath = path.join(globalAssetsPath, 'sounds');

    if (fs.existsSync(globalImagesPath)) {
      const destGlobalImages = path.join(publicDir, 'global', 'images');
      try {
        fsExtra.copySync(globalImagesPath, destGlobalImages, { overwrite: true });
        if (verbose) {
          console.log(`✅ Copied global images to global/images`);
        }
        assetsCopied = true;
      } catch (e) {
        console.error('❌ Failed to copy global images:', e.message);
      }
    }

    if (fs.existsSync(globalSoundsPath)) {
      const destGlobalSounds = path.join(publicDir, 'global', 'sounds');
      try {
        fsExtra.copySync(globalSoundsPath, destGlobalSounds, { overwrite: true });
        if (verbose) {
          console.log(`✅ Copied global sounds to global/sounds`);
        }
        assetsCopied = true;
      } catch (e) {
        console.error('❌ Failed to copy global sounds:', e.message);
      }
    }
  }

  // Copy location-specific assets to assets/[location]/
  const locationsPath = path.join(projectRoot, 'locations');
  if (fs.existsSync(locationsPath)) {
    const locations = fs
      .readdirSync(locationsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const location of locations) {
      const locationPath = path.join(locationsPath, location);
      const locationImagesPath = path.join(locationPath, 'images');
      const locationSoundsPath = path.join(locationPath, 'sounds');

      if (fs.existsSync(locationImagesPath)) {
        const destLocationImages = path.join(publicDir, location, 'images');
        try {
          fsExtra.copySync(locationImagesPath, destLocationImages, {
            overwrite: true,
          });
          if (verbose) {
            console.log(
              `✅ Copied ${location} images to ${location}/images`
            );
          }
          assetsCopied = true;
        } catch (e) {
          console.error(`❌ Failed to copy ${location} images:`, e.message);
        }
      }

      if (fs.existsSync(locationSoundsPath)) {
        const destLocationSounds = path.join(publicDir, location, 'sounds');
        try {
          fsExtra.copySync(locationSoundsPath, destLocationSounds, {
            overwrite: true,
          });
          if (verbose) {
            console.log(
              `✅ Copied ${location} sounds to ${location}/sounds`
            );
          }
          assetsCopied = true;
        } catch (e) {
          console.error(`❌ Failed to copy ${location} sounds:`, e.message);
        }
      }
    }
  }

  if (!assetsCopied) {
    if (verbose) {
      console.log(`🟡 No assets found for project. Skipping asset copy.`);
    }
  }

  return assetsCopied;
}

module.exports = { copyProjectAssets };