// projectTree.js (ESM)
import { symbols } from '../utils/log.js';
import { writeProjectActionsAndEvents } from './projectActionsAndEvents.js';

export async function writeProjectData(gen) {
  console.log(`${symbols.build}  Generate project ...`);
  await writeProjectActionsAndEvents(gen);
}
