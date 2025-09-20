

import { symbols } from '../utils/log.js';
import { writeGlobalTexts, writeLocationTexts } from '../utils/textsKind.js';

// --- writeEngine minuscule : orchestre seulement ---
export async function writeTextsData(gen) {
  console.log(`${symbols.build}  Generate text ...`);


  // LOCATIONS (texts)
  const locIds = Object.keys(gen.last_tree.locations?.dirs || {}).sort();
  for (const id of locIds) {
    await writeLocationTexts(gen, id);
  }
  await writeGlobalTexts(gen);
}
