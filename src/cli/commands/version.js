"use strict";

const fs = require("fs");
const path = require("path");

function readVersionSafe() {
  const candidates = [
    path.resolve(__dirname, "../../package.json"),
    path.resolve(__dirname, "../../../package.json"),
  ];
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, "utf8");
      const pkg = JSON.parse(txt);
      if (pkg && pkg.version) return pkg.version;
    } catch {}
  }
  return "0.0.0";
}

module.exports = function version() {
  console.log(readVersionSafe());
};

