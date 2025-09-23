// textTree.js (ESM)
import { symbols } from '../utils/log.js';
import { writeTexts } from './texts.js';

export async function writeTextsData(gen) {
  console.log(`${symbols.build}  Generate text ...`);
  await writeTexts(gen);
}
