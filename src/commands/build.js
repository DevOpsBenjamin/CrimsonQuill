import { symbols } from '../utils/log.js';
import { loadConfig } from '../utils/config.js'
import { ProjectGenerator } from '../generator/index.js'

export default async function build({ args = [] }) {
  const verbose = args && args.includes('/verbose');
  const ignoreTranslations = args && args.includes('/ignore-translations');

  try {
    const config = await loadConfig();
    console.log(`Config DBG:${config}`)
    const generator = new ProjectGenerator(config, verbose);

    // Phase 1: run generate all
    generator.run();

  } catch (e) {
    console.error(`${symbols.error} Build failed:`, e?.message || e);
    throw e; // remonte l’erreur au binaire (qui fixera exitCode)
  }
}
