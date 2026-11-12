import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const files = [
  'index.html',
  'style.css',
  'app.js',
  'solver.js',
  'worker.js',
  'sw.js',
  'icon.svg',
  'manifest.webmanifest',
  'data/sowpods.txt.gz',
  'data/shapes.bin.gz',
];

// Check every input before replacing the previous generated output.
const contents = await Promise.all(files.map(file => readFile(path.join(root, file))));
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'data'), { recursive: true });
await Promise.all(files.map((file, i) => writeFile(path.join(dist, file), contents[i])));

// Cloudflare Pages reads this file as response-header configuration.
await writeFile(path.join(dist, '_headers'), `/sw.js
  Cache-Control: no-cache
/data/*.gz
  Content-Type: application/gzip
`);

console.log(`Built ${files.length} app files and Cloudflare headers into dist/.`);
