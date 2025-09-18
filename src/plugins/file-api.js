const path = require('path');
const fs = require('fs');

function createFileApiPlugin({ projectRoot }) {
  return {
    name: 'vuevn-file-api',
    configureServer(server) {
      // Helper function to handle JSON responses
      const sendJson = (res, data, statusCode = 200) => {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      // Helper function to read request body
      const getRequestBody = (req) => {
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => resolve(body));
          req.on('error', reject);
        });
      };

      // List files endpoint: returns array of { type, name, path, size, modified }
      server.middlewares.use('/api/files', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const dirParam = url.searchParams.get('path') || url.searchParams.get('dir') || '';
          const targetPath = path.join(projectRoot, dirParam);

          // Security check
          if (!targetPath.startsWith(projectRoot)) {
            return sendJson(res, { error: 'Access denied' }, 403);
          }
          if (!fs.existsSync(targetPath)) {
            // Mirror previous behavior in UI: 404 triggers auto-create for subfolders
            res.statusCode = 404;
            return sendJson(res, { error: 'Not found' }, 404);
          }

          const items = fs.readdirSync(targetPath, { withFileTypes: true }).map(dirent => {
            const abs = path.join(targetPath, dirent.name);
            const rel = path.join(dirParam, dirent.name).replace(/\\/g, '/');
            const stat = fs.statSync(abs);
            return dirent.isDirectory()
              ? { type: 'directory', name: dirent.name, path: rel, size: 0, modified: new Date(stat.mtimeMs).toISOString() }
              : { type: 'file', name: dirent.name, path: rel, size: stat.size, modified: new Date(stat.mtimeMs).toISOString() };
          });
          return sendJson(res, items);
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });

      // Read file endpoint
      server.middlewares.use('/api/file', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const filePath = url.searchParams.get('path');
          
          if (!filePath) {
            return sendJson(res, { error: 'Path parameter required' }, 400);
          }
          
          const targetPath = path.join(projectRoot, filePath);
          
          // Security check
          if (!targetPath.startsWith(projectRoot)) {
            return sendJson(res, { error: 'Access denied' }, 403);
          }
          
          if (!fs.existsSync(targetPath)) {
            return sendJson(res, { error: 'File not found' }, 404);
          }
          
          const content = fs.readFileSync(targetPath, 'utf8');
          sendJson(res, { content });
        } catch (error) {
          sendJson(res, { error: error.message }, 500);
        }
      });

      // Write file endpoint
      server.middlewares.use('/api/file', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        
        try {
          const body = await getRequestBody(req);
          const { path: filePath, content } = JSON.parse(body);
          
          if (!filePath) {
            return sendJson(res, { error: 'Path parameter required' }, 400);
          }
          
          const targetPath = path.join(projectRoot, filePath);
          
          // Security check
          if (!targetPath.startsWith(projectRoot)) {
            return sendJson(res, { error: 'Access denied' }, 403);
          }
          
          // Ensure directory exists
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(targetPath, content, 'utf8');
          sendJson(res, { success: true });
        } catch (error) {
          sendJson(res, { error: error.message }, 500);
        }
      });

      // Create file/folder with optional template
      server.middlewares.use('/api/create', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const body = await getRequestBody(req);
          const { path: relPath, type, template, name } = JSON.parse(body);
          if (!relPath || !type) return sendJson(res, { error: 'path and type required' }, 400);
          const targetPath = path.join(projectRoot, relPath);
          if (!targetPath.startsWith(projectRoot)) return sendJson(res, { error: 'Access denied' }, 403);
          const dir = require('path').dirname(targetPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          if (type === 'directory') {
            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
            return sendJson(res, { success: true });
          }
          // file types
          let content = '';
          const fileName = name || relPath.split('/').pop();
          const baseName = (fileName || '').replace(/\.ts$/i, '').replace(/\.vue$/i, '');
          if (template === 'event') {
            content = `import type { VNEvent } from '@generate/types';\n\nconst ${baseName}: VNEvent = {\n  name: '${baseName}',\n  unlocked: () => true,\n  async execute(engine, state) {\n    await engine.showText('Hello from ${baseName}');\n  },\n};\n\nexport default ${baseName};\n`;
          } else if (template === 'location-info') {
            content = `import type { Location } from '@generate/types';\n\nconst info: Location = {\n  name: '${baseName}',\n  baseBackground: null,\n  timeBackgrounds: [],\n  unlocked: () => true,\n  accessErrors: [],\n};\n\nexport default info;\n`;
          } else if (template === 'component') {
            content = `<template>\n  <div class=\"p-4\">${baseName} component</div>\n</template>\n<script setup lang=\"ts\">\n</script>\n`;
          } else if (template === 'store') {
            content = `import { defineStore } from 'pinia';\n\nexport const use${baseName.charAt(0).toUpperCase() + baseName.slice(1)} = defineStore('${baseName}', {\n  state: () => ({ /* ... */ }),\n});\n`;
          }
          fs.writeFileSync(targetPath, content, 'utf8');
          return sendJson(res, { success: true });
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });

      // Rename
      server.middlewares.use('/api/rename', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { oldPath, newPath } = JSON.parse(await getRequestBody(req));
          if (!oldPath || !newPath) return sendJson(res, { error: 'oldPath and newPath required' }, 400);
          const src = path.join(projectRoot, oldPath);
          const dst = path.join(projectRoot, newPath);
          if (!src.startsWith(projectRoot) || !dst.startsWith(projectRoot)) return sendJson(res, { error: 'Access denied' }, 403);
          const dstDir = path.dirname(dst);
          if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
          fs.renameSync(src, dst);
          return sendJson(res, { success: true });
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });

      // Delete
      server.middlewares.use('/api/delete', async (req, res, next) => {
        if (req.method !== 'DELETE') return next();
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const relPath = url.searchParams.get('path');
          if (!relPath) return sendJson(res, { error: 'path required' }, 400);
          const targetPath = path.join(projectRoot, relPath);
          if (!targetPath.startsWith(projectRoot)) return sendJson(res, { error: 'Access denied' }, 403);
          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
            else fs.unlinkSync(targetPath);
          }
          return sendJson(res, { success: true });
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });

      // Templates metadata
      server.middlewares.use('/api/project/templates', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const templates = {
          event: `import type { VNEvent } from '@generate/types';\n\nconst MyEvent: VNEvent = {\n  name: 'MyEvent',\n  unlocked: () => true,\n  async execute(engine, state) {\n    await engine.showText('Hello');\n  },\n};\n\nexport default MyEvent;\n`,
          component: `<template>\n  <div class=\"p-4\">New Component</div>\n</template>\n<script setup lang=\"ts\">\n</script>\n`,
          locationInfo: `import type { Location } from '@generate/types';\nexport default { name: 'New Location', baseBackground: null, timeBackgrounds: [], unlocked: () => true, accessErrors: [] } as const;\n`,
        };
        return sendJson(res, templates);
      });

      // Helper: raw body as Buffer (for multipart)
      const getRawBody = (req) => new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      // Helper: parse multipart form-data (basic, single file supported)
      function parseMultipart(buffer, contentType) {
        const m = /boundary=([^;]+)/i.exec(contentType || '');
        if (!m) return null;
        const boundary = `--${m[1]}`;
        const boundaryBuf = Buffer.from(boundary);
        const crlf = Buffer.from('\r\n');
        const dbl = Buffer.from('\r\n\r\n');
        const parts = [];
        let start = buffer.indexOf(boundaryBuf);
        while (start !== -1) {
          start += boundaryBuf.length;
          // Skip optional CRLF
          if (buffer[start] === 13 && buffer[start+1] === 10) start += 2;
          const next = buffer.indexOf(boundaryBuf, start);
          const endBoundary = buffer.indexOf(Buffer.from(boundary + '--'), start);
          const end = next !== -1 ? next - 2 /* remove CRLF before boundary */
            : (endBoundary !== -1 ? endBoundary - 2 : -1);
          if (end === -1) break;
          // Split headers and content
          const headerEnd = buffer.indexOf(dbl, start);
          if (headerEnd === -1 || headerEnd > end) break;
          const headerBuf = buffer.slice(start, headerEnd);
          const contentBuf = buffer.slice(headerEnd + dbl.length, end);
          const headers = headerBuf.toString('utf8').split('\r\n').reduce((acc, line) => {
            const idx = line.indexOf(':');
            if (idx !== -1) acc[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
            return acc;
          }, {});
          const cd = headers['content-disposition'] || '';
          const nameMatch = /name="([^"]+)"/.exec(cd);
          const filenameMatch = /filename="([^"]*)"/.exec(cd);
          const name = nameMatch ? nameMatch[1] : '';
          const filename = filenameMatch ? filenameMatch[1] : '';
          const contentTypeHeader = headers['content-type'] || '';
          parts.push({ name, filename, contentType: contentTypeHeader, data: contentBuf });
          if (next === -1 && endBoundary === -1) break;
          start = next !== -1 ? next : endBoundary;
        }
        const fields = {};
        const files = {};
        for (const p of parts) {
          if (p.filename) files[p.name] = p;
          else fields[p.name] = p.data.toString('utf8');
        }
        return { fields, files };
      }

      function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
      function detectCategory(filename) {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'images';
        if (['mp3','wav','ogg'].includes(ext)) return 'sounds';
        if (['mp4','webm'].includes(ext)) return 'videos';
        return 'misc';
      }

      // Upload asset endpoint: supports multipart (FormData) and JSON(base64)
      server.middlewares.use('/api/assets/upload', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const ctype = req.headers['content-type'] || '';
          if (/multipart\/form-data/i.test(ctype)) {
            const raw = await getRawBody(req);
            const parsed = parseMultipart(raw, ctype);
            if (!parsed || !parsed.files || !parsed.files['file']) {
              return sendJson(res, { error: 'No file in multipart form-data' }, 400);
            }
            const file = parsed.files['file'];
            const dest = parsed.fields['dest']; // optional
            const category = detectCategory(file.filename || '');
            const targetDir = dest ? path.join(projectRoot, dest) : path.join(projectRoot, 'global', category);
            const targetPath = path.join(targetDir, file.filename || 'file');
            if (!targetPath.startsWith(projectRoot)) return sendJson(res, { error: 'Access denied' }, 403);
            ensureDir(targetDir);
            fs.writeFileSync(targetPath, file.data);
            return sendJson(res, { success: true, path: targetPath.replace(projectRoot + path.sep, '').replace(/\\/g, '/') });
          }

          // Fallback: JSON { path, data(base64) }
          const body = await getRequestBody(req);
          const { path: assetPath, data } = JSON.parse(body);
          if (!assetPath || !data) return sendJson(res, { error: 'Path and data required' }, 400);
          const targetPath = path.join(projectRoot, assetPath);
          if (!targetPath.startsWith(projectRoot)) return sendJson(res, { error: 'Access denied' }, 403);
          ensureDir(path.dirname(targetPath));
          fs.writeFileSync(targetPath, Buffer.from(data, 'base64'));
          return sendJson(res, { success: true, path: assetPath });
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });

      // List all assets grouped by category (global + locations)
      server.middlewares.use('/api/assets/list', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const images = [];
          const sounds = [];
          const videos = [];
          const misc = [];

          function pushItem(rel) {
            try {
              const abs = path.join(projectRoot, rel);
              const st = fs.statSync(abs);
              const item = { name: path.basename(rel), path: rel.replace(/\\/g, '/'), size: st.size || 0, modified: new Date(st.mtimeMs).toISOString() };
              const ext = (rel.split('.').pop() || '').toLowerCase();
              if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) images.push(item);
              else if (['mp3','wav','ogg'].includes(ext)) sounds.push(item);
              else if (['mp4','webm'].includes(ext)) videos.push(item);
              else misc.push(item);
            } catch {}
          }

          function walk(relDir) {
            const absDir = path.join(projectRoot, relDir);
            if (!fs.existsSync(absDir)) return;
            for (const dirent of fs.readdirSync(absDir, { withFileTypes: true })) {
              const rel = path.join(relDir, dirent.name);
              if (dirent.isDirectory()) walk(rel);
              else pushItem(rel);
            }
          }

          // Global
          walk('global');
          // Locations
          const locsDir = path.join(projectRoot, 'locations');
          if (fs.existsSync(locsDir)) {
            for (const dirent of fs.readdirSync(locsDir, { withFileTypes: true })) {
              if (!dirent.isDirectory()) continue;
              walk(path.join('locations', dirent.name));
            }
          }

          return sendJson(res, { images, sounds, videos, misc });
        } catch (error) {
          return sendJson(res, { error: error.message }, 500);
        }
      });
    }
  };
}

module.exports = { createFileApiPlugin };
