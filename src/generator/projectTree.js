// projectData.js (ESM)
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { symbols } from '../utils/log.js';

/* ----------------- helpers tree ----------------- */
const isTS = (ext) => (ext || '').toLowerCase() === '.ts';

function getDir(node, segs) {
  let cur = node;
  for (const s of segs) {
    if (!cur || !cur.dirs) return null;
    cur = cur.dirs[s];
  }
  return cur || null;
}
function listDirs(node) { return node?.dirs ? Object.keys(node.dirs) : []; }
function listFiles(node) { return Array.isArray(node?.files) ? node.files : []; }

/* récursif: collecte tous les .ts sous un noeud en renvoyant les chemins relatifs internes */
function collectTsRelPaths(node, prefix = '') {
  if (!node) return [];
  const out = [];
  for (const f of listFiles(node)) {
    if (isTS(f.ext)) out.push(prefix ? `${prefix}/${f.name}` : f.name); // sans extension
  }
  for (const [seg, child] of Object.entries(node.dirs || {})) {
    const nextPrefix = prefix ? `${prefix}/${seg}` : seg;
    out.push(...collectTsRelPaths(child, nextPrefix));
  }
  return out.sort();
}

/* existence d’un fichier exact (relatif à project/) */
function hasProjectFile(projectRoot, relPath) {
  const parts = relPath.split('/');
  const file = parts.pop();
  let node = projectRoot;
  for (const seg of parts) {
    node = node?.dirs?.[seg];
    if (!node) return false;
  }
  return !!listFiles(node).find(f => f.relPath === relPath && isTS(f.ext));
}

/* ----------------- builders de code ----------------- */
function buildActionsModule(locationId, keys, sourceBase = '@project') {
  // import variables anonymes pour éviter les soucis d’identifiants
  const imports = keys.map((k, i) =>
    `import a${i} from '${sourceBase}/locations/${locationId}/actions/${k}';`
  );
  const dict = keys.map((k, i) => `  "${k}": a${i}`).join(',\n');
  const paths = keys.map((k) => `  "${k}": "locations/${locationId}/actions/${k}"`).join(',\n');

  return `// Generated actions for location: ${locationId}
import type { VNAction } from '@generate/types';

${imports.join('\n')}

export const actionsList: Record<string, VNAction> = {
${dict}
};

export default actionsList;

export const actionsPaths: Record<string, string> = {
${paths}
};
`;
}

function buildEventsModule(locationId, keys, sourceBase = '@project') {
  const imports = keys.map((k, i) =>
    `import e${i} from '${sourceBase}/locations/${locationId}/events/${k}';`
  );
  const dict = keys.map((k, i) => `  "${k}": e${i}`).join(',\n');
  const paths = keys.map((k) => `  "${k}": "locations/${locationId}/events/${k}"`).join(',\n');

  return `// Generated events for location: ${locationId}
import type { VNEvent } from '@generate/types';

${imports.join('\n')}

export const eventsList: Record<string, VNEvent> = {
${dict}
};

export default eventsList;

export const eventsPaths: Record<string, string> = {
${paths}
};
`;
}

function buildLocationIndex(locationId, hasInfoImport = true) {
  const infoLine = hasInfoImport
    ? `import info from '@project/locations/${locationId}/info';`
    : `const info = {} as any; // no @project/locations/${locationId}/info.ts`;

  return `// Generated index for location: ${locationId}
import type { LocationData } from '@generate/types';
${infoLine}
import actions, { actionsPaths } from './actions';
import events, { eventsPaths } from './events';

const ${locationId}: LocationData = {
  id: "${locationId}",
  info: info,
  actions: actions,
  actionsPaths: actionsPaths,
  events: events,
  eventsPaths: eventsPaths,
  accessibles: {}
};

export default ${locationId};
`;
}

function buildGlobalActions(keys, sourceBase = '@project') {
  const imports = keys.map((k, i) => `import ga${i} from '${sourceBase}/global/actions/${k}';`);
  const dict = keys.map((k, i) => `  "${k}": ga${i}`).join(',\n');
  const paths = keys.map((k) => `  "${k}": "global/actions/${k}"`).join(',\n');
  return `// Generated global actions
import type { VNAction } from '@generate/types';
${imports.join('\n')}

export const actions: Record<string, VNAction> = {
${dict}
};

export const actionsPaths: Record<string, string> = {
${paths}
};

export default actions;
`;
}

function buildGlobalEvents(keys, sourceBase = '@project') {
  const imports = keys.map((k, i) => `import ge${i} from '${sourceBase}/global/events/${k}';`);
  const dict = keys.map((k, i) => `  "${k}": ge${i}`).join(',\n');
  const paths = keys.map((k) => `  "${k}": "global/events/${k}"`).join(',\n');
  return `// Generated global events
import type { VNEvent } from '@generate/types';
${imports.join('\n')}

export const events: Record<string, VNEvent> = {
${dict}
};

export const eventsPaths: Record<string, string> = {
${paths}
};

export default events;
`;
}

function buildGlobalIndex() {
  return `// Generated project global index
import actions, { actionsPaths } from './actions';
import events,  { eventsPaths }  from './events';

const globalData = {
  actions,
  actionsPaths,
  events,
  eventsPaths
} as const;

export default globalData;
`;
}

function buildProjectIndex(projectId, locationIds) {
  const imports = locationIds.map(id => `import ${id} from './locations/${id}';`).join('\n');
  const locPairs = locationIds.map(id => `  "${id}": ${id}`).join(',\n');

  return `// Generated project data index
import config from '@project/config';
import type { LocationData, ProjectData } from '@generate/types';
${imports}
import global from './global';

const locations: Record<string, LocationData> = {
${locPairs}
};

const projectData: ProjectData = {
  project_id: "${projectId}",
  config: config(),
  locations: locations,
  global: global
};

export default projectData;
`;
}

/* ----------------- collecte depuis le tree ----------------- */
function collectLocationIds(projectRoot) {
  const locationsNode = getDir(projectRoot, ['locations']);
  return listDirs(locationsNode).sort();
}
function collectActionsForLocation(projectRoot, locId) {
  return collectTsRelPaths(getDir(projectRoot, ['locations', locId, 'actions']));
}
function collectEventsForLocation(projectRoot, locId) {
  return collectTsRelPaths(getDir(projectRoot, ['locations', locId, 'events']));
}
function hasInfoForLocation(projectRoot, locId) {
  return hasProjectFile(projectRoot, `locations/${locId}/info.ts`);
}
function collectGlobalActions(projectRoot) {
  return collectTsRelPaths(getDir(projectRoot, ['global', 'actions']));
}
function collectGlobalEvents(projectRoot) {
  return collectTsRelPaths(getDir(projectRoot, ['global', 'events']));
}

/* ----------------- write utils ----------------- */
async function writeTextFile(dir, name, content) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), content, 'utf8');
}

/* ----------------- API STEP 3 ----------------- */
export async function writeProjectData(gen) {
  console.log(`${symbols.build}  Generate project data ...`);

  const projectRoot = gen.last_tree?.project || { files: [], dirs: {} };
  const outRoot = join(gen.generate_dir, 'project');

  // GLOBAL (actions + events)
  const gActions = collectGlobalActions(projectRoot);
  const gEvents = collectGlobalEvents(projectRoot);
  await writeTextFile(join(outRoot, 'global'), 'actions.ts', buildGlobalActions(gActions));
  await writeTextFile(join(outRoot, 'global'), 'events.ts', buildGlobalEvents(gEvents));
  await writeTextFile(join(outRoot, 'global'), 'index.ts', buildGlobalIndex());

  // LOCATIONS
  const locationIds = collectLocationIds(projectRoot);
  for (const id of locationIds) {
    const actions = collectActionsForLocation(projectRoot, id);
    const events = collectEventsForLocation(projectRoot, id);
    const infoOK = hasInfoForLocation(projectRoot, id);

    const locDir = join(outRoot, 'locations', id);
    await writeTextFile(locDir, 'actions.ts', buildActionsModule(id, actions));
    await writeTextFile(locDir, 'events.ts', buildEventsModule(id, events));
    await writeTextFile(locDir, 'index.ts', buildLocationIndex(id, infoOK));
  }

  // INDEX PROJET
  const projectId = String(gen?.config?.project_id ?? gen?.config?.name ?? 'project');
  await writeTextFile(outRoot, 'index.ts', buildProjectIndex(projectId, locationIds));
}
