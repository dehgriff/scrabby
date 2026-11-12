import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { solveRack, getSlots, scoreBoard } from '../solver.js';

const dictionary = gunzipSync(readFileSync(new URL('../data/sowpods.txt.gz', import.meta.url))).toString().trim().split('\n');
const words = new Set(dictionary);
const shapes = new Uint8Array(gunzipSync(readFileSync(new URL('../data/shapes.bin.gz', import.meta.url))));

// Validate independently of the solver's slot extraction and score calculation.
function validate(result, rack) {
  const remaining = [...rack];
  const board = new Map();
  result.cells.forEach((p, i) => {
    const char = result.letters[i];
    const index = remaining.indexOf(char);
    assert.notEqual(index, -1, `Tile ${char} must be available`);
    remaining.splice(index, 1);
    board.set(`${Math.floor(p / 16)},${p % 16}`, char);
  });
  assert.equal(board.size, result.cells.length, 'No overlapping tiles');
  assert.deepEqual(remaining.sort(), [...result.unused].sort());
  if (!board.size) { assert.equal(result.score, 0); return; }
  const visited = new Set();
  const pending = [board.keys().next().value];
  while (pending.length) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const [r,c] = key.split(',').map(Number);
    for (const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
      const neighbor = `${r+dr},${c+dc}`;
      if (board.has(neighbor) && !visited.has(neighbor)) pending.push(neighbor);
    }
  }
  assert.equal(visited.size, board.size, 'Every tile must connect');
  const found = [];
  for (const key of board.keys()) {
    const [r,c] = key.split(',').map(Number);
    for (const [dr,dc] of [[0,1],[1,0]]) {
      if (board.has(`${r-dr},${c-dc}`)) continue;
      let word = '';
      for (let n = 0; board.has(`${r+n*dr},${c+n*dc}`); n++) word += board.get(`${r+n*dr},${c+n*dc}`);
      if (word.length > 1) { assert.ok(words.has(word), `${word} must be SOWPODS`); found.push(word); }
    }
  }
  assert.deepEqual([...result.words].sort(), found.sort());
  assert.equal(result.score, Math.max(...found.map(w => w.length)) + found.length + Number(board.size === 12));
}

test('full SOWPODS list is bundled, with short and long words', () => {
  assert.equal(dictionary.length, 267751);
  for (const word of ['AA', 'QI', 'ZA', 'DETENT', 'QUIZZICAL']) assert.ok(words.has(word));
});

test('shape catalogue is complete by known fixed-polyomino counts, modulo transpose', () => {
  const expected = [0,0,1,4,10,34,110,388,1369,4982,18246,67727,253014];
  const actual = Array(13).fill(0);
  let previousScore = Infinity;
  let maximumCount = 0;
  for (let offset = 0; offset < shapes.length;) {
    const size = shapes[offset++];
    const score = shapes[offset++];
    const cells = shapes.subarray(offset, offset + size);
    offset += size;
    assert.ok(score <= previousScore);
    previousScore = score;
    actual[size]++;
    if (score === 17) maximumCount++;
    assert.equal(scoreBoard(cells, Array(size).fill('A')).score, score);
  }
  assert.deepEqual(actual, expected);
  assert.equal(maximumCount, 2);
});

test('crossings and adjacent words all score, including duplicate words', () => {
  assert.equal(getSlots([0,1,16,17]).length, 4);
  assert.deepEqual(scoreBoard([0,1,16,17], ['A','A','A','A']), { score: 6, longest: 2, bonus: 0, words: ['AA','AA','AA','AA'] });
});

for (const [rack, score] of [
  ['AEINORSTATED',17],
  ['AAAAAAAAAAAA',14],
  ['ABCDEFGHIJKL',14],
  ['QQQQQQQQQQQI',4],
  ['QZXJKVVVVVVV',0],
]) {
  test(`${rack}: valid, proven ${score}-point optimum`, () => {
    const result = solveRack(rack, dictionary, shapes);
    validate(result, rack);
    assert.equal(result.score, score);
    assert.equal(result.optimal, true);
  });
}

test('a rack with only QI proves unused-tile fallback against a tiny dictionary', () => {
  const result = solveRack('QQQQQQQQQQQI', ['QI'], shapes);
  assert.equal(result.score, 4); // QI across and down, sharing the one I.
  assert.equal(result.unused.length, 9);
});

test('rack validation rejects wrong length, case and nonletters', () => {
  for (const rack of ['', 'ABC', 'ABCDEFGHIJKLM', 'abcdefghijkl', 'ABCDEFGHIJK?']) {
    assert.throws(() => solveRack(rack, dictionary, shapes), /12 letters/);
  }
});
