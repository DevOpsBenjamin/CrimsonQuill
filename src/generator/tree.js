import fg from 'fast-glob';
import { existsSync } from 'node:fs';
import { join, posix as pathPosix } from 'node:path';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tiff', 'tif', 'dds', 'exr'];
const AUDIO_EXT = ['mp3', 'ogg', 'flac', 'wav', 'm4a', 'opus', 'aac', 'mid', 'midi'];
const VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'ts'];

const DEFAULT_PATTERNS = [
  '**/*.ts',
  '**/*.vue',
  `**/*.{${IMAGE_EXT.join(',')}}`,
  `**/*.{${AUDIO_EXT.join(',')}}`,
  `**/*.{${VIDEO_EXT.join(',')}}`,
];

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/generate/**',
  '**/.*',              // dotfiles/dirs at root of a segment
];

export function buildFolderTree(folderPath) {
  if (!existsSync(folderPath)) {
    return { files: [], dirs: {} };
  }

  const entries = fg.sync(DEFAULT_PATTERNS, {
    cwd: folderPath,
    dot: false,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
    followSymbolicLinks: true,
    unique: true,
    absolute: false,
  });

  return createTreeFromPaths(entries);
}

export function createTreeFromPaths(relPaths) {
  const root = { files: [], dirs: {} };

  for (const rel of relPaths) {
    const parts = rel.split('/');
    const filename = parts.pop();
    if (!filename) continue;

    // descend/create dirs
    let node = root;
    for (const seg of parts) {
      if (!seg) continue;
      node.dirs[seg] ||= { files: [], dirs: {} };
      node = node.dirs[seg];
    }

    const ext = pathPosix.extname(filename).toLowerCase();
    const name = ext ? filename.slice(0, -ext.length) : filename;
    const type = classifyByExt(ext);

    node.files.push({
      name,          // filename without extension
      ext,           // ".vue" | ".ts" | etc.
      type,          // 'ts' | 'vue' | 'image' | 'audio' | 'video' | 'other'
      relPath: rel,  // <-- relative to folderPath (source path)
    });
  }

  return root;
}

function classifyByExt(ext) {
  const e = (ext || '').replace(/^\./, '').toLowerCase();
  if (e === 'ts') return 'ts';
  if (e === 'vue') return 'vue';
  if (IMAGE_EXT.includes(e)) return 'image';
  if (AUDIO_EXT.includes(e)) return 'audio';
  if (VIDEO_EXT.includes(e)) return 'video';
  return 'other';
}

// === Résolution ultra-simple du dossier src d’un plugin npm ===
function resolvePluginSrcDir(pluginName, project_path) {
  const srcDir = join(project_path, 'node_modules', pluginName, 'src');
  return existsSync(srcDir) ? srcDir : null; // si pas de src → on ignore
}

// === createTree principal (inclut plugins npm du config) ===
export function createTree(node_path, project_path, config = {}) {
  const globalDir = join(project_path, 'global');
  const locationsDir = join(project_path, 'locations');
  const projectPluginsDir = join(project_path, 'plugins'); // plugins locaux du projet
  const engineDir = join(node_path, 'engine');

  const tree = {
    global: buildFolderTree(globalDir),
    locations: buildFolderTree(locationsDir),
    project: buildFolderTree(projectPluginsDir),
    engine: buildFolderTree(engineDir),
    plugins: [], // un élément par plugin npm déclaré
  };

  const pluginNames = Array.isArray(config.plugins) ? config.plugins : [];
  for (const name of pluginNames) {
    const srcDir = resolvePluginSrcDir(name, project_path);
    if (!srcDir) continue; // on skip s’il n’y a pas de src
    tree.plugins.push({
      name,
      tree: buildFolderTree(srcDir), // relPath relatifs à <project>/node_modules/<name>/src
    });
  }

  return tree;
}
