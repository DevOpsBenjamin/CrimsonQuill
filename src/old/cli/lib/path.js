"use strict";

const path = require("path");

function toPosix(p) {
  return String(p || "").replace(/\\/g, "/");
}

function normalize(p) {
  return toPosix(p).replace(/^\//, "");
}

function resolveSafe(root, relOrAbs) {
  const abs = path.resolve(root, relOrAbs || "");
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

function isUnder(file, root) {
  const abs = path.resolve(file);
  const rootAbs = path.resolve(root);
  const rel = path.relative(rootAbs, abs);
  return !(rel.startsWith("..") || path.isAbsolute(rel));
}

module.exports = {
  toPosix,
  normalize,
  resolveSafe,
  isUnder,
};

