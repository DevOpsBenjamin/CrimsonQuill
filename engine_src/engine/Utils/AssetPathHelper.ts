/**
 * Converts absolute asset paths (starting with /) to relative paths (starting with ./)
 * This ensures compatibility with file:// URLs and different build contexts
 */
export function normalizeAssetPath(path: string | null): string | null {
  if (!path) return path;
  
  // If path starts with /, convert to ./
  if (path.startsWith('/')) {
    return '.' + path;
  }
  
  return path;
}

/**
 * Normalizes an array of asset paths
 */
export function normalizeAssetPaths(paths: string[]): string[] {
  return paths.map(path => normalizeAssetPath(path) || '');
}