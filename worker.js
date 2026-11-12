import { solveRack } from './solver.js';
import { prepareDictionary } from './dictionary.js';

async function loadText(path) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.text();
}

async function unpack(path, type) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const unpacked = new Response(stream);
  return type === 'text' ? unpacked.text() : new Uint8Array(await unpacked.arrayBuffer());
}

const ready = Promise.all([
  unpack('./data/sowpods.txt.gz', 'text'),
  unpack('./data/shapes.bin.gz'),
  loadText('./data/two-letter-words.txt'),
  loadText('./data/three-letter-words.txt'),
]).then(([text, shapes, pairs, triples]) => [prepareDictionary(text, pairs, triples), shapes]);
ready.then(() => postMessage({ type: 'ready' })).catch(error => postMessage({ type: 'error', message: error.message }));

self.onmessage = async ({ data }) => {
  try {
    const [dictionary, shapes] = await ready;
    const result = solveRack(data.rack, dictionary, shapes, update => postMessage(update));
    postMessage({ type: 'result', result });
  } catch (error) {
    postMessage({ type: 'error', message: error.message });
  }
};
