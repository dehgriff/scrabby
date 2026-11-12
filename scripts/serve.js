import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.gz': 'application/gzip' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(403).end(); return;
    }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => {
  console.log(`Scrabby: http://localhost:${port}`);
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries || []) {
    if (entry.family === 'IPv4' && !entry.internal) console.log(`On your phone (same Wi-Fi): http://${entry.address}:${port}`);
  }
});
