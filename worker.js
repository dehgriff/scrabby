import { solveRack } from './solver.js';

async function unpack(path, type) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const unpacked = new Response(stream);
  return type === 'text' ? unpacked.text() : new Uint8Array(await unpacked.arrayBuffer());
}

const ready = Promise.all([unpack('./data/sowpods.txt.gz', 'text'), unpack('./data/shapes.bin.gz')]);
ready.then(() => postMessage({ type: 'ready' })).catch(error => postMessage({ type: 'error', message: error.message }));

self.onmessage = async ({ data }) => {
  try {
    const [text, shapes] = await ready;
    const result = solveRack(data.rack, text.trim().split('\n'), shapes, update => postMessage(update));
    postMessage({ type: 'result', result });
  } catch (error) {
    postMessage({ type: 'error', message: error.message });
  }
};
