"use strict";

const path = require("path");
const fse = require("fs-extra");
const fg = require("fast-glob");
const { ensureDir, writeFileIfChanged, normalize } = require("./utils");

function writeProjectStructure({ projectRoot, outDir, verbose }) {
  const toPosix = (p) => normalize(p).replace(/^\//, '');
  // Helpers
  function listTs(base) {
    return fg.sync('**/*.ts', { cwd: base, onlyFiles: true, ignore: ['**/*.d.ts', '**/.*', '**/node_modules/**'] });
  }
  function importSpecFromProject(rel) {
    // rel is like 'global/actions/wait.ts' or 'locations/bedroom/events/x.ts'
    return `@project/${toPosix(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`;
  }
  function writeGlobal() {
    const gBase = path.join(projectRoot, 'global');
    const actionsDir = path.join(gBase, 'actions');
    const eventsDir = path.join(gBase, 'events');
    const gOutDir = path.join(outDir, 'global');
    ensureDir(gOutDir);

    // actions
    const actions = fse.pathExistsSync(actionsDir) ? listTs(actionsDir) : [];
    const aLines = [
      `// Generated actions for global location`,
      `import type { VNAction } from '@generate/types';`,
      '',
    ];
    const aMap = [];
    const aPaths = [];
    for (const rel of actions.sort()) {
      const name = path.basename(rel, '.ts');
      const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const spec = importSpecFromProject(path.join('global', 'actions', rel));
      aLines.push(`import ${alias} from '${spec}';`);
      aMap.push(`  ${JSON.stringify(name)}: ${alias}`);
      aPaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
    }
    aLines.push('', `export const actionsList: Record<string, VNAction> = {`, aMap.join(',\n'), `};`, '', `export default actionsList;`, '', `export const actionsPaths: Record<string, string> = {`, aPaths.join(',\n'), `};`, '');
    writeFileIfChanged(path.join(gOutDir, 'actions.ts'), aLines.join('\n'));

    // events
    const events = fse.pathExistsSync(eventsDir) ? listTs(eventsDir) : [];
    const eLines = [
      `// Generated events for global location`,
      `import type { VNEvent } from '@generate/types';`,
      '',
    ];
    const eMap = [];
    const ePaths = [];
    for (const rel of events.sort()) {
      const name = path.basename(rel, '.ts');
      const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const spec = importSpecFromProject(path.join('global', 'events', rel));
      eLines.push(`import ${alias} from '${spec}';`);
      eMap.push(`  ${JSON.stringify(name)}: ${alias}`);
      ePaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
    }
    eLines.push('', `export const eventsList: Record<string, VNEvent> = {`, eMap.join(',\n'), `};`, '', `export default eventsList;`, '', `export const eventsPaths: Record<string, string> = {`, ePaths.join(',\n'), `};`, '');
    writeFileIfChanged(path.join(gOutDir, 'events.ts'), eLines.join('\n'));

    // index
    const idx = [];
    idx.push(`// Generated index for global location`);
    idx.push(`import type { LocationData } from '@generate/types';`);
    idx.push(`import { actionsList, actionsPaths } from './actions';`);
    idx.push(`import { eventsList, eventsPaths } from './events';`);
    idx.push('');
    idx.push(`const global: LocationData = {`);
    idx.push(`  id: "global",`);
    idx.push(`  actions: actionsList,`);
    idx.push(`  actionsPaths: actionsPaths,`);
    idx.push(`  events: eventsList,`);
    idx.push(`  eventsPaths: eventsPaths,`);
    idx.push(`  accessibles: {}`);
    idx.push(`};`);
    idx.push('');
    idx.push(`export default global;`);
    writeFileIfChanged(path.join(gOutDir, 'index.ts'), idx.join('\n'));

    if (verbose) {
      try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear}  Global: ${actions.length} action(s), ${events.length} event(s)`); } catch { console.log(`[vuevn] Global: ${actions.length} actions, ${events.length} events`); }
    }
  }

  function writeLocations() {
    const locsDir = path.join(projectRoot, 'locations');
    if (!fse.pathExistsSync(locsDir)) return [];
    const locIds = fg.sync('*', { cwd: locsDir, onlyDirectories: true, deep: 1 });
    const list = [];
    let totalActions = 0, totalEvents = 0;
    for (const locId of locIds.sort()) {
      list.push(locId);
      const lBase = path.join(locsDir, locId);
      const lOut = path.join(outDir, 'locations', locId);
      ensureDir(lOut);

      // actions
      const actionsDir = path.join(lBase, 'actions');
      const actions = fse.pathExistsSync(actionsDir) ? listTs(actionsDir) : [];
      const aLines = [
        `// Generated actions for location: ${locId}`,
        `import type { VNAction } from '@generate/types';`,
        '',
      ];
      const aMap = [];
      const aPaths = [];
      for (const rel of actions.sort()) {
        const name = path.basename(rel, '.ts');
        const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
        const spec = importSpecFromProject(path.join('locations', locId, 'actions', rel));
        aLines.push(`import ${alias} from '${spec}';`);
        aMap.push(`  ${JSON.stringify(name)}: ${alias}`);
        aPaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
      }
      aLines.push('', `export const actionsList: Record<string, VNAction> = {`, aMap.join(',\n'), `};`, '', `export default actionsList;`, '', `export const actionsPaths: Record<string, string> = {`, aPaths.join(',\n'), `};`, '');
      writeFileIfChanged(path.join(lOut, 'actions.ts'), aLines.join('\n'));

      // events
      const eventsDir = path.join(lBase, 'events');
      const events = fse.pathExistsSync(eventsDir) ? listTs(eventsDir) : [];
      const eLines = [
        `// Generated events for location: ${locId}`,
        `import type { VNEvent } from '@generate/types';`,
        '',
      ];
      const eMap = [];
      const ePaths = [];
      for (const rel of events.sort()) {
        const name = path.basename(rel, '.ts');
        const alias = name.replace(/[^a-zA-Z0-9_]/g, '_');
        const spec = importSpecFromProject(path.join('locations', locId, 'events', rel));
        eLines.push(`import ${alias} from '${spec}';`);
        eMap.push(`  ${JSON.stringify(name)}: ${alias}`);
        ePaths.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rel.replace(/\\/g,'/').replace(/\.ts$/i,''))}`);
      }
      eLines.push('', `export const eventsList: Record<string, VNEvent> = {`, eMap.join(',\n'), `};`, '', `export default eventsList;`, '', `export const eventsPaths: Record<string, string> = {`, ePaths.join(',\n'), `};`, '');
      writeFileIfChanged(path.join(lOut, 'events.ts'), eLines.join('\n'));

      // index
      const iLines = [];
      iLines.push(`// Generated index for location: ${locId}`);
      iLines.push(`import type { LocationData } from '@generate/types';`);
      // optional info
      const infoPath = path.join(lBase, 'info.ts');
      if (fse.pathExistsSync(infoPath)) {
        const spec = importSpecFromProject(path.join('locations', locId, 'info.ts'));
        iLines.push(`import info from '${spec}';`);
      }
      iLines.push(`import actions, { actionsPaths } from './actions';`);
      iLines.push(`import events, { eventsPaths } from './events';`);
      iLines.push('');
      iLines.push(`const ${locId}: LocationData = {`);
      iLines.push(`  id: ${JSON.stringify(locId)},`);
      if (fse.pathExistsSync(infoPath)) iLines.push(`  info: info,`);
      iLines.push(`  actions: actions,`);
      iLines.push(`  actionsPaths: actionsPaths,`);
      iLines.push(`  events: events,`);
      iLines.push(`  eventsPaths: eventsPaths,`);
      iLines.push(`  accessibles: {}`);
      iLines.push(`};`);
      iLines.push('');
      iLines.push(`export default ${locId};`);
      writeFileIfChanged(path.join(lOut, 'index.ts'), iLines.join('\n'));

      totalActions += actions.length; totalEvents += events.length;
      if (verbose) {
        try { const { symbols } = require('../utils/log'); console.log(`${symbols.gear}  Location ${locId}: ${actions.length} action(s), ${events.length} event(s)`); } catch { console.log(`[vuevn] Location ${locId}: ${actions.length} actions, ${events.length} events`); }
      }
    }
    return list;
  }

  function writeProject() {
    const out = [];
    out.push(`// Generated project data index`);
    out.push(`import config from '@project/config';`);
    out.push(`import type { LocationData, ProjectData } from '@generate/types';`);
    const locIds = fg.sync('*', { cwd: path.join(projectRoot, 'locations'), onlyDirectories: true, deep: 1 }).sort();
    for (const locId of locIds) {
      out.push(`import ${locId} from './locations/${locId}';`);
    }
    out.push(`import global from './global';`);
    out.push('');
    out.push(`const locations: Record<string, LocationData> = {`);
    for (const locId of locIds) out.push(`  ${JSON.stringify(locId)}: ${locId},`);
    out.push(`};`);
    out.push('');
    const projectId = path.basename(projectRoot);
    out.push(`const projectData: ProjectData = {`);
    out.push(`  project_id: ${JSON.stringify(projectId)},`);
    out.push(`  config: config(),`);
    out.push(`  locations: locations,`);
    out.push(`  global: global`);
    out.push(`};`);
    out.push('');
    out.push(`export default projectData;`);
    writeFileIfChanged(path.join(outDir, 'project.ts'), out.join('\n'));
  }

  writeGlobal();
  const locList = writeLocations();
  writeProject();
  if (verbose) { try { const { symbols } = require('../utils/log'); console.log(`${symbols.done} Wrote project structure under ${normalize(path.relative(projectRoot, outDir))}`); } catch { console.log(`[vuevn] generate: wrote project structure under ${normalize(path.relative(projectRoot, outDir))}`); } }
}

module.exports = { writeProjectStructure };
