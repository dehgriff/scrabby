import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareDictionary, prepareCommonDictionary } from '../dictionary.js';
import { gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const files = [
  'index.html',
  'style.css',
  'app.js',
  'tile-bag.js',
  'solver.js',
  'dictionary.js',
  'worker.js',
  'sw.js',
  'icon.svg',
  'manifest.webmanifest',
  'data/sowpods.txt.gz',
  'data/shapes.bin.gz',
  'data/two-letter-words.txt',
  'data/three-letter-words.txt',
  'data/common-words.txt',
  'data/wordfreq-NOTICE.md',
  'data/wordfreq-data-LICENSE.txt',
  'data/common-words-info.txt',
];

// Check every input before replacing the previous generated output.
const contents = await Promise.all(files.map(file => readFile(path.join(root, file))));
// Fail before publishing a typo or a non-SOWPODS entry in either editable list.
const dictionary = prepareDictionary(
  gunzipSync(contents[files.indexOf('data/sowpods.txt.gz')]).toString(),
  contents[files.indexOf('data/two-letter-words.txt')].toString(),
  contents[files.indexOf('data/three-letter-words.txt')].toString(),
);
prepareCommonDictionary(dictionary, contents[files.indexOf('data/common-words.txt')].toString());
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
