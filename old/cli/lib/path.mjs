import path from 'path';

export function toPosix(p) {
  return String(p || '').replace(/\\/g, '/');
}

export function normalize(p) {
  return toPosix(p).replace(/^\//, '');
}

export function resolveSafe(root, relOrAbs) {
  const abs = path.resolve(root, relOrAbs || '');
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

export function isUnder(file, root) {
  const abs = path.resolve(file);
  const rootAbs = path.resolve(root);
  const rel = path.relative(rootAbs, abs);
  return !(rel.startsWith('..') || path.isAbsolute(rel));
}

export default { toPosix, normalize, resolveSafe, isUnder };

