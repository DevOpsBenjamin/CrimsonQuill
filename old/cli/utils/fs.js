"use strict";

const fs = require("fs");
const fse = require("fs-extra");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`Template not found: ${src}`);
  fse.ensureDirSync(dest);
  // Prefer fs-extra for robust, cross-platform directory copy
  fse.copySync(src, dest, { overwrite: true, errorOnExist: false });
}

module.exports = { copyDir };
