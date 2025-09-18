// Plugin Vite pour gérer les alias VueVN automatiquement
import path from 'path';

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

export function createVueVNAliasPlugin(options = {}) {
  const { projectRoot, cliRoot } = options;

  return {
    name: 'vuevn-alias-plugin',
    config(config) {
      // Ajouter les alias VueVN automatiquement
      if (!config.resolve) config.resolve = {};
      if (!config.resolve.alias) config.resolve.alias = {};

      // Alias pour le framework
      config.resolve.alias['@vuevn/cli'] = toPosix(cliRoot);

      // Alias pour le projet utilisateur
      config.resolve.alias['@generate'] = toPosix(path.join(projectRoot, 'generate'));
      config.resolve.alias['@plugins'] = toPosix(path.join(projectRoot, 'plugins'));
      config.resolve.alias['@locations'] = toPosix(path.join(projectRoot, 'locations'));
      config.resolve.alias['@global'] = toPosix(path.join(projectRoot, 'global'));
      config.resolve.alias['@project'] = toPosix(projectRoot);

      // Alias pour l'engine
      config.resolve.alias['@vuevn/engine_src'] = toPosix(path.join(cliRoot, 'engine_src'));
      config.resolve.alias['@engine'] = toPosix(path.join(cliRoot, 'engine_src'));
      // Alias editor
      config.resolve.alias['@editor'] = toPosix(path.join(cliRoot, 'editor_src'));

      // Rediriger les dépendances vers celles du projet
      config.resolve.alias['vue'] = toPosix(path.join(projectRoot, 'node_modules', 'vue'));
      config.resolve.alias['pinia'] = toPosix(path.join(projectRoot, 'node_modules', 'pinia'));
      config.resolve.alias['pinia-plugin-persistedstate'] = toPosix(path.join(projectRoot, 'node_modules', 'pinia-plugin-persistedstate'));
    }
  };
}
