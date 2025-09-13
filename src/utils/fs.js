"use strict";

const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`Template not found: ${src}`);
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

module.exports = { copyDir };
