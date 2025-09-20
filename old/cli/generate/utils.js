"use strict";

const fs = require("fs");
const path = require("path");

function normalize(p) {
  return p.replace(/\\/g, '/').replace(/^\//, '');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFileIfChanged(filePath, content) {
  ensureDir(path.dirname(filePath));
  let prev = null;
  try { 
    prev = fs.readFileSync(filePath, 'utf8'); 
  } catch {}
  if (prev !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

module.exports = {
  normalize,
  ensureDir,
  writeFileIfChanged
};