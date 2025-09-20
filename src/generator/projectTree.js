// projectTree.js (ESM)
import { symbols } from '../utils/log.js';
import { writeLocationKind, writeGlobalKind } from '../utils/projectKind.js';


// --- writeEngine minuscule : orchestre seulement ---
export async function writeProjectData(gen) {
  console.log(`${symbols.build}  Generate projet ...`);

  // LOCATIONS (actions + events)
  const locIds = Object.keys(gen.last_tree.locations?.dirs || {}).sort();
  for (const id of locIds) {
    await writeLocationKind(gen, id, 'actions');
    await writeLocationKind(gen, id, 'events');
  }

  // GLOBAL (actions + events)
  await writeGlobalKind(gen, 'actions');
  await writeGlobalKind(gen, 'events');
}
