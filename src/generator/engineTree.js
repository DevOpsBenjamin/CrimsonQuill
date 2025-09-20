// engineTree.js (ESM)
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { symbols } from '../utils/log.js';

// Helper: itère tous les fichiers d’un arbre { files, dirs }
function* iterateFiles(node, prefix = '') {
  for (const f of node.files || []) {
    // relPath est déjà fourni; sinon, reconstruire avec prefix + f.name + f.ext
    const relPath = f.relPath ?? (prefix ? `${prefix}/${f.name}${f.ext}` : `${f.name}${f.ext}`);
    yield {
      relPath,
      name: f.name,
      ext: (f.ext || '').toLowerCase(),
      type: f.type,
      source: f.source,         // <-- important
    };
  }
  const dirs = node.dirs || {};
  for (const [seg, child] of Object.entries(dirs)) {
    const nextPrefix = prefix ? `${prefix}/${seg}` : seg;
    yield* iterateFiles(child, nextPrefix);
  }
}

// Helper: construit un arbre { files, dirs } depuis une map relPath -> file
function buildTreeFromMap(map) {
  const root = { files: [], dirs: {} };
  for (const [, rec] of map) {
    const parts = rec.relPath.split('/');
    const filename = parts.pop();
    let node = root;
    for (const seg of parts) {
      if (!seg) continue;
      node.dirs[seg] ||= { files: [], dirs: {} };
      node = node.dirs[seg];
    }
    node.files.push({
      name: rec.name,
      ext: rec.ext,
      type: rec.type,
      relPath: rec.relPath,
      source: rec.source,
    });
  }
  return root;
}

// merge principal
function buildEngineTree(trees, verbose = false) {
  const result = new Map(); // relPath -> { name, ext, type, relPath, source }
  const engine = trees?.engine ?? { files: [], dirs: {} };
  const project = trees?.project ?? { files: [], dirs: {} };
  const plugins = Array.isArray(trees?.plugins) ? trees.plugins : [];

  // 1) baseline = ENGINE (priorité la plus faible)
  const engineSet = new Set();
  for (const f of iterateFiles(engine)) {
    engineSet.add(f.relPath);
    result.set(f.relPath, { ...f, source: 'engine' });
  }

  // util log
  const logAdd = (src, rel) => {
    if (verbose) console.log(`${symbols.add}  add from ${src}: ${rel}`);
  };
  const logOverride = (fromSrc, toSrc, rel) => {
    if (verbose) console.log(`${symbols.override}  override ${rel}: ${fromSrc} -> ${toSrc}`);
  };

  // 2) overlay = PLUGINS dans l’ordre fourni
  for (const plug of plugins) {
    const srcTree = plug?.tree ?? { files: [], dirs: {} };
    const label = plug.name;
    for (const f of iterateFiles(srcTree)) {
      const existed = result.has(f.relPath);
      if (existed) {
        const prev = result.get(f.relPath);
        logOverride(prev.source, label, f.relPath);
      } else if (!engineSet.has(f.relPath)) {
        // nouveau par rapport à ENGINE
        logAdd(label, f.relPath);
      }
      result.set(f.relPath, { ...f, source: label });
    }
  }

  // 3) overlay = PROJECT (priorité la plus haute)
  for (const f of iterateFiles(project)) {
    const existed = result.has(f.relPath);
    if (existed) {
      const prev = result.get(f.relPath);
      if (prev.source !== 'project') {
        logOverride(prev.source, 'project', f.relPath);
      }
    } else if (!engineSet.has(f.relPath)) {
      logAdd('project', f.relPath);
    }
    result.set(f.relPath, { ...f, source: 'project' });
  }

  // 4) reconstruit un arbre { files, dirs } (avec source par fichier)
  return buildTreeFromMap(result);
}

// --- helpers de base (tout petits) ---
const toPosix = (p) => p.replace(/\\/g, '/');
const aliasFor = (src) => (src === 'engine' ? '@engine' : src === 'project' ? '@project' : `@plugins/${src}`);
const isTS = (ext) => ext === '.ts';
const isVue = (ext) => ext === '.vue';
const inTypesFolder = (dirPath) => dirPath === 'types' || dirPath.split('/').includes('types');

// --- regroupe les fichiers par dossier ---
function groupByDir(tree) {
  const groups = new Map(); // dirPath -> files[]
  for (const f of iterateFiles(tree)) {
    const rel = f.relPath;
    const i = rel.lastIndexOf('/');
    const dir = i === -1 ? '' : rel.slice(0, i);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({ ...f, ext: (f.ext || '').toLowerCase() });
  }
  return groups;
}

// --- construit UNE ligne d’export pour un fichier (ou null si on n’exporte pas) ---
function buildExportLine(file, inTypes) {
  const { relPath, ext, source, name } = file;

  // types/* -> export type * (TS uniquement)
  if (inTypes && isTS(ext)) {
    const target = `${aliasFor(source)}/${toPosix(relPath.replace(/\.[^/.]+$/, ''))}`;
    return `export type * from '${target}';`;
  }

  // .ts / .vue -> export default as Name
  if (isTS(ext) || isVue(ext)) {
    const targetSub = isTS(ext) ? relPath.replace(/\.[^/.]+$/, '') : relPath; // TS sans ext, Vue avec ext
    const target = `${aliasFor(source)}/${toPosix(targetSub)}`;
    return `export { default as ${name} } from '${target}';`;
  }

  // images/audio/vidéo -> pas d’export dans l’index de dossier
  return null;
}

// --- écrit l’index.ts d’un dossier ---
async function writeIndexForDir(generate_dir, dirPath, files) {
  const outDir = dirPath ? join(generate_dir, ...dirPath.split('/')) : generate_dir;
  await mkdir(outDir, { recursive: true });

  // tri stable
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const lines = [];
  const typesFlag = inTypesFolder(dirPath);

  for (const f of files) {
    const line = buildExportLine(f, typesFlag);
    if (line) lines.push(line);
  }

  // toujours terminer par une newline
  lines.push('');
  await writeFile(join(outDir, 'index.ts'), lines.join('\n'), 'utf8');
}

// --- writeEngine minuscule : orchestre seulement ---
export async function writeEngine(gen) {
  console.log(`${symbols.build}  Generate engine ...`);
  const engineTree = buildEngineTree(gen.last_tree, gen.verbose); // garde ton merge
  const groups = groupByDir(engineTree);

  for (const [dirPath, files] of groups) {
    await writeIndexForDir(gen.generate_dir, dirPath, files);
  }

  if (gen.DEBUG || gen.verbose) {
    await writeFile(
      join(gen.project_path, 'engine-tree.json'),
      JSON.stringify(engineTree, null, 2),
      'utf8'
    );
    console.log(`✔ wrote index.ts for ${groups.size} folders`);
  }
}
