import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefinitionLookup, DefinitionDialog } from '../definitions.js';

const payload = word => [{ word, phonetics: [{ text: '/test/' }], meanings: [
  { partOfSpeech: 'noun', definitions: [{ definition: `${word} meaning`, example: 'An example.', synonyms: ['example'] }] },
  { partOfSpeech: 'verb', definitions: [{ definition: `${word} action` }] },
], sourceUrls: ['https://example.com/source'], license: { name: 'CC BY-SA', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } }];
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test('definitions are fetched on demand, formatted into meanings and cached case-insensitively', async () => {
  const requests = [];
  const lookup = createDefinitionLookup(async (...args) => { requests.push(args); return response(payload('cat')); });
  assert.equal(requests.length, 0);
  const first = await lookup('CAT');
  assert.equal(first.found, true);
  assert.equal(first.entries[0].meanings.length, 2);
  assert.equal(first.entries[0].phonetic, '/test/');
  assert.equal(first.entries[0].meanings[0].definitions[0].example, 'An example.');
  assert.equal(await lookup('cat'), first);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], 'https://api.dictionaryapi.dev/api/v2/entries/en/cat');
});

test('the documented missing-definition response is handled for both 404 and 200', async () => {
  for (const status of [404, 200]) {
    let count = 0;
    const lookup = createDefinitionLookup(async () => { count++; return response({ title: 'No Definitions Found', message: 'Sorry pal' }, status); });
    assert.deepEqual(await lookup('IE'), { found: false, entries: [] });
    await lookup('ie');
    assert.equal(count, 1);
  }
});

test('failed requests are retryable, and incomplete words never reach the API', async () => {
  let count = 0;
  const lookup = createDefinitionLookup(async () => ++count === 1 ? response({}, 503) : response(payload('cat')));
  await assert.rejects(lookup('C?T'), /complete word/);
  assert.equal(count, 0);
  await assert.rejects(lookup('CAT'), /could not complete/);
  assert.equal((await lookup('CAT')).found, true);
  assert.equal(count, 2);
});

test('cancelled requests do not poison later lookups', async () => {
  const controller = new AbortController();
  controller.abort();
  const lookup = createDefinitionLookup(async (_url, { signal }) => {
    signal?.throwIfAborted();
    return response(payload('cat'));
  });
  await assert.rejects(lookup('CAT', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal((await lookup('CAT')).found, true);
});

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  set innerHTML(_) { throw new Error('API content must be rendered as text'); }
}

function fixture(t) {
  const original = globalThis.document;
  const title = new Node('h2');
  globalThis.document = { createElement: tag => new Node(tag), getElementById: () => title };
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
  const dialog = Object.create(DefinitionDialog.prototype);
  Object.assign(dialog, { version: 0, content: new Node('div'), dialog: { open: false, showModal() { this.open = true; } } });
  return dialog;
}
const allNodes = node => [node, ...node.children.flatMap(allNodes)];
const text = node => allNodes(node).map(item => item.textContent).join(' ');

test('invalid Play words are rejected locally without a definition request', async t => {
  const dialog = fixture(t);
  let calls = 0;
  dialog.lookup = async () => { calls++; };
  await dialog.open('ZZZ', async () => false);
  assert.equal(calls, 0);
  assert.match(text(dialog.content), /not in Scrabby/);
});

test('the modal formats parts of speech, examples and attribution, rendering API text safely', async t => {
  const dialog = fixture(t);
  const entries = payload('cat');
  entries[0].meanings[0].definitions[0].definition = '<img src=x onerror=alert(1)>';
  entries[0].sourceUrls.push('javascript:alert(1)');
  dialog.lookup = createDefinitionLookup(async () => response(entries));
  await dialog.open('CAT');
  const nodes = allNodes(dialog.content);
  assert.match(text(dialog.content), /noun.*<img src=x onerror=alert\(1\)>.*An example.*verb/);
  assert.equal(nodes.filter(node => node.tag === 'ol').length, 2);
  assert.ok(nodes.some(node => node.tag === 'a' && node.textContent === 'CC BY-SA'));
  assert.ok(!nodes.some(node => node.href?.startsWith('javascript:')));
});

test('a late response cannot replace the definition of a more recently selected word', async t => {
  const dialog = fixture(t);
  const pending = {};
  dialog.lookup = word => new Promise(resolve => { pending[word] = resolve; });
  const first = dialog.open('CAT');
  const second = dialog.open('DOG');
  pending.DOG({ found: false, entries: [] });
  await second;
  pending.CAT({ found: false, entries: [] });
  await first;
  assert.match(text(dialog.content), /DOG/);
  assert.doesNotMatch(text(dialog.content), /CAT/);
});
