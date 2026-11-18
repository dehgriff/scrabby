import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { solveRack, getSlots } from '../solver.js';
import { createTiles, moveTile, getPlayMainWord } from '../play-model.js';

const shapes = new Uint8Array(gunzipSync(readFileSync(new URL('../data/shapes.bin.gz', import.meta.url))));
const dictionary = gunzipSync(readFileSync(new URL('../data/sowpods.txt.gz', import.meta.url))).toString().trim().split(/\s+/);

function validate(result, rack, allowed, main) {
  assert.equal(result.requiredMainWord, main);
  const slots = getSlots(result.cells);
  assert.ok(slots.some(slot => result.cells[slot[1]] - result.cells[slot[0]] === 1 && slot.map(i => result.letters[i]).join('') === main), 'the required word must run horizontally');
  assert.equal(result.longest, main.length);
  for (const word of result.words) assert.ok(allowed.has(word), word);
  const remaining = [...rack];
  for (let i = 0; i < result.letters.length; i++) {
    const physical = result.blankIndices.includes(i) ? '?' : result.letters[i];
    const index = remaining.indexOf(physical);
    assert.ok(index >= 0, `missing physical tile ${physical}`);
    remaining.splice(index, 1);
  }
  assert.deepEqual(remaining.sort(), [...result.unused].sort());
}

test('the required main word remains horizontal through every search update, with or without blanks', () => {
  for (const rack of ['AEINORSTATED', 'AEINORSTAT??']) {
    const reports = [];
    const result = solveRack(rack, dictionary, shapes, update => { if (update.type === 'best') reports.push(update.result); }, [], 'STATED');
    for (const candidate of [...reports, result]) validate(candidate, rack, new Set(dictionary), 'STATED');
    assert.equal(result.optimal, true);
    assert.ok(result.score <= solveRack(rack, dictionary, shapes).score);
  }
});

test('every equal-length slot is tried, and a required vertical slot is transposed even when another longest word is already horizontal', () => {
  const words = ['AB', 'AC', 'BD', 'CD'];
  const catalogue = Uint8Array.from([4, 6, 0, 1, 16, 17]);
  const rack = 'ABCDZZZZZZZZ';
  const result = solveRack(rack, words, catalogue, () => {}, [], 'CD');
  validate(result, rack, new Set(words), 'CD');
  assert.equal(result.score, 6);
  assert.equal(result.cells.length, 4);
});

test('a required word in a transposed shape preserves word spelling and crossings', () => {
  const rack = 'TONGIPZZZZZZ';
  const words = ['TONG', 'TIP'];
  const catalogue = Uint8Array.from([6, 6, 0, 1, 2, 16, 32, 48]);
  const result = solveRack(rack, words, catalogue, () => {}, [], 'TONG');
  validate(result, rack, new Set(words), 'TONG');
  assert.deepEqual([...result.words].sort(), ['TIP', 'TONG']);
  assert.equal(result.score, 6);
});

test('keeping a shorter main word rules out longer words, with a proven baseline fallback', () => {
  const rack = 'CATZZZZZZZZZ';
  const words = ['AT', 'CAT'];
  const result = solveRack(rack, words, shapes, () => {}, [], 'AT');
  validate(result, rack, new Set(words), 'AT');
  assert.equal(result.score, 3);
  assert.equal(result.optimal, true);
  assert.equal(solveRack(rack, words, shapes).score, 4);
});

test('unavailable, rejected, malformed and unmakeable main words fail explicitly', () => {
  for (const [word, rejected] of [['DOG', []], ['CAT', ['CAT']], ['C?T', []], ['cat', []]]) {
    assert.throws(() => solveRack('CATZZZZZZZZZ', ['CAT'], shapes, () => {}, rejected, word), /main word|not allowed/);
  }
  assert.throws(() => solveRack('AAAAAAAAAAAA', ['CAT'], shapes, () => {}, [], 'CAT'), /cannot be made/);
});

test('Play chooses a complete longest horizontal word and prefers the original row for ties', () => {
  const tiles = createTiles('CATDOG??????');
  assert.equal(getPlayMainWord(tiles), '');
  for (const [id, x, y] of [[0, 0, 0], [1, 1, 0], [2, 2, 0], [3, 0, -2], [4, 1, -2], [5, 2, -2]]) moveTile(tiles, id, x, y);
  assert.equal(getPlayMainWord(tiles), 'CAT');
  tiles[0].letter = '';
  assert.equal(getPlayMainWord(tiles), 'DOG');
  moveTile(tiles, 6, 0, -3);
  moveTile(tiles, 7, 0, -1);
  assert.equal(getPlayMainWord(tiles), '', 'a shorter word cannot stand in for a longer vertical main word');
});
