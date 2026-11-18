import { solveRack } from './solver.js';
import { prepareDictionary, prepareCommonDictionary } from './dictionary.js';
import { checkArrangement } from './play-model.js';

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
  loadText('./data/common-words.txt'),
]).then(([text, shapes, pairs, triples, commonText]) => {
  const dictionary = prepareDictionary(text, pairs, triples);
  return { dictionary, dictionarySet: new Set(dictionary), commonDictionary: prepareCommonDictionary(dictionary, commonText), shapes };
});
ready.then(({ dictionary }) => postMessage({
  type: 'ready',
  twoLetterWords: dictionary.filter(word => word.length === 2).sort(),
})).catch(error => postMessage({ type: 'error', message: error.message }));

self.onmessage = async ({ data }) => {
  try {
    const { dictionary, dictionarySet, commonDictionary, shapes } = await ready;
    if (data.type === 'check') {
      postMessage({ type: 'checked', revision: data.revision, result: checkArrangement(data.tiles, dictionarySet) });
      return;
    }
    const selectedDictionary = data.commonWords ? commonDictionary : dictionary;
    const result = solveRack(data.rack, selectedDictionary, shapes, update => postMessage(update), data.rejectedWords || [], data.requiredMainWord || '');
    postMessage({ type: 'result', result });
  } catch (error) {
    postMessage({ type: data.type === 'check' ? 'check-error' : 'error', revision: data.revision, message: error.message });
  }
};
