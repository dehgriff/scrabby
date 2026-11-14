import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { prepareDictionary, prepareCommonDictionary } from '../dictionary.js';

const dictionary = gunzipSync(readFileSync(new URL('../data/sowpods.txt.gz', import.meta.url))).toString().trim().split('\n');
const commonText = readFileSync(new URL('../data/common-words.txt', import.meta.url), 'utf8');

test('common mode filters four-letter-plus words and keeps the chosen short words exactly', () => {
  const normal = prepareDictionary('AA\nAT\nCAT\nDOG\nCATS\nDOGS\nDETENT\n', 'AT', 'CAT');
  const common = prepareCommonDictionary(normal, 'cats\r\n# everyday words\r\nCATS\r\nDOGS\r\n');
  assert.deepEqual(common, ['AT', 'CAT', 'CATS', 'DOGS']);
  assert.ok(!common.includes('AA'));
  assert.ok(!common.includes('DOG'));
  assert.ok(normal.includes('DETENT'), 'SOWPODS mode remains available');
  assert.deepEqual(prepareCommonDictionary(normal, ''), ['AT', 'CAT']);
});

test('the common list cannot introduce non-SOWPODS words or override short-word choices', () => {
  assert.throws(() => prepareCommonDictionary(['CATS'], 'ZZZZZZ'), /common-words.txt, line 1/);
  assert.throws(() => prepareCommonDictionary(['AT', 'CATS'], 'CATS\nAT'), /common-words.txt, line 2/);
  assert.throws(() => prepareCommonDictionary(['CATS'], '1234'), /common-words.txt/);
});

test('bundled common words are unique, sorted SOWPODS entries of 4–12 letters', () => {
  const entries = commonText.trim().split('\n');
  assert.equal(entries.length, 12204);
  assert.equal(new Set(entries).size, entries.length);
  assert.deepEqual(entries, [...entries].sort());
  const sowpods = new Set(dictionary);
  for (const word of entries) {
    assert.match(word, /^[A-Z]{4,12}$/);
    assert.ok(sowpods.has(word), `${word} must be SOWPODS`);
  }
  const common = new Set(entries);
  for (const word of ['FRIEND', 'GARDEN', 'LETTER', 'SPEED', 'TOWER']) assert.ok(common.has(word));
  for (const word of ['DETENT', 'INHERE', 'RIBIER', 'PITHIER', 'REEMIT', 'ANATTO']) assert.ok(!common.has(word));
});
