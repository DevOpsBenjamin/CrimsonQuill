// utils/treeUtils.js (ESM)
import { join } from 'node:path';
import { mkdir, writeFile as fsWriteFile } from 'node:fs/promises';

export const isTS = (ext) => (ext || '').toLowerCase() === '.ts';

export function getDir(node, segs = []) {
  let cur = node;
  for (const s of segs) {
    if (!cur?.dirs) return null;
    cur = cur.dirs[s];
  }
  return cur || null;
}

export function listDirs(node) {
  return node?.dirs ? Object.keys(node.dirs) : [];
}

export function listFiles(node) {
  return Array.isArray(node?.files) ? node.files : [];
}

// Récursif: retourne les chemins internes SANS extension (ex "a/b/c")
export function collectTsRelPaths(node, prefix = '') {
  if (!node) return [];
  const out = [];
  for (const f of listFiles(node)) {
    if (isTS(f.ext)) out.push(prefix ? `${prefix}/${f.name}` : f.name);
  }
  for (const [seg, child] of Object.entries(node.dirs || {})) {
    const next = prefix ? `${prefix}/${seg}` : seg;
    out.push(...collectTsRelPaths(child, next));
  }
  return out.sort();
}

// Existence d’un fichier exact (relatif à une racine donnée du tree)
export function hasFile(projectRoot, relPath) {
  const parts = relPath.split('/');
  parts.pop(); // filename
  let node = projectRoot;
  for (const seg of parts) {
    node = node?.dirs?.[seg];
    if (!node) return false;
  }
  return !!listFiles(node).find(f => f.relPath === relPath && isTS(f.ext));
}

export async function writeTextFile(dir, name, content) {
  await mkdir(dir, { recursive: true });
  await fsWriteFile(join(dir, name), content, 'utf8');
}

