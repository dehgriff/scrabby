import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { solveRack, getSlots, scoreBoard } from '../solver.js';
import { prepareDictionary } from '../dictionary.js';

const dictionary = gunzipSync(readFileSync(new URL('../data/sowpods.txt.gz', import.meta.url))).toString().trim().split('\n');
const words = new Set(dictionary);
const shapes = new Uint8Array(gunzipSync(readFileSync(new URL('../data/shapes.bin.gz', import.meta.url))));

// Validate independently of the solver's slot extraction and score calculation.
function validate(result, rack, allowedWords = words) {
  const remaining = [...rack];
  const board = new Map();
  const blankIndices = new Set(result.blankIndices);
  assert.equal(blankIndices.size, result.blankIndices.length, 'Blank indices cannot repeat');
  assert.ok([...blankIndices].every(i => Number.isInteger(i) && i >= 0 && i < result.cells.length));
  result.cells.forEach((p, i) => {
    const char = result.letters[i];
    const index = remaining.indexOf(blankIndices.has(i) ? '?' : char);
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
  let longestHorizontal = 0;
  for (const key of board.keys()) {
    const [r,c] = key.split(',').map(Number);
    for (const [dr,dc] of [[0,1],[1,0]]) {
      if (board.has(`${r-dr},${c-dc}`)) continue;
      let word = '';
      for (let n = 0; board.has(`${r+n*dr},${c+n*dc}`); n++) word += board.get(`${r+n*dr},${c+n*dc}`);
      if (word.length > 1) {
        assert.ok(allowedWords.has(word), `${word} must be allowed`);
        found.push(word);
        if (dr === 0) longestHorizontal = Math.max(longestHorizontal, word.length);
      }
    }
  }
  assert.deepEqual([...result.words].sort(), found.sort());
  assert.equal(result.score, Math.max(...found.map(w => w.length)) + found.length + Number(board.size === 12));
  assert.equal(longestHorizontal, result.longest, 'A longest word must run horizontally');
}

test('vertical longest word is transposed with crossings and blanks preserved', () => {
  // CAT down, CA across: a four-tile shape that beats the one-word baseline.
  const verticalShape = Uint8Array.from([4, 5, 0, 1, 16, 32]);
  const rack = 'ACTZZZZZZZZ?';
  const result = solveRack(rack, ['CAT', 'CA'], verticalShape);
  validate(result, rack, new Set(['CAT', 'CA']));
  assert.equal(result.score, 5);
  assert.equal(result.blankIndices.length, 1);
  const slot = getSlots(result.cells).find(s => s.length === 3);
  assert.equal(result.cells[slot[1]] - result.cells[slot[0]], 1);
  assert.equal(slot.map(i => result.letters[i]).join(''), 'CAT');
});

test('TONG and TIP keep their spelling when the main word is transposed horizontally', () => {
  const verticalShape = Uint8Array.from([6, 6, 0, 1, 2, 16, 32, 48]);
  const rack = 'TONGIPZZZZZZ';
  const result = solveRack(rack, ['TONG', 'TIP'], verticalShape);
  validate(result, rack, new Set(['TONG', 'TIP']));
  assert.equal(result.score, 6);
  const slots = getSlots(result.cells);
  const main = slots.find(slot => slot.length === 4);
  const crossing = slots.find(slot => slot.length === 3);
  assert.equal(main.map(i => result.letters[i]).join(''), 'TONG');
  assert.equal(crossing.map(i => result.letters[i]).join(''), 'TIP');
  assert.equal(result.cells[main[1]] - result.cells[main[0]], 1);
  assert.equal(result.cells[crossing[1]] - result.cells[crossing[0]], 16);
});

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
  for (const rack of ['', 'ABC', 'ABCDEFGHIJKLM', 'abcdefghijkl', 'ABCDEFGHIJK!']) {
    assert.throws(() => solveRack(rack, dictionary, shapes), /12 letters/);
  }
  assert.throws(() => solveRack('ABCDEFGH????', dictionary, shapes), /at most 3/);
});

for (const rack of ['AEINORSTATE?', 'AEINORSTAT??', 'AEINORSTA???']) {
  test(`${rack}: blanks make a valid 17-point optimum`, () => {
    const result = solveRack(rack, dictionary, shapes);
    validate(result, rack);
    assert.equal(result.score, 17);
    assert.equal(result.blankIndices.length, [...rack].filter(ch => ch === '?').length);
    assert.equal(result.optimal, true);
  });
}

test('a crossing shares a single blank representing I between two QI words', () => {
  const rack = 'QQQQQQQQQQQ?';
  const result = solveRack(rack, ['QI'], shapes);
  validate(result, rack, new Set(['QI']));
  assert.equal(result.score, 4);
  assert.equal(result.blankIndices.length, 1);
  assert.equal(result.letters[result.blankIndices[0]], 'I');
  assert.equal(result.cells.length, 3);
});

test('two blanks cannot supply three As, even though each AA word fits in isolation', () => {
  const rack = 'ZZZZZZZZZZ??';
  const result = solveRack(rack, ['AA'], shapes);
  validate(result, rack, new Set(['AA']));
  assert.equal(result.score, 3);
  assert.equal(result.blankIndices.length, 2);
  assert.equal(result.cells.length, 2);
  assert.equal(result.unused.length, 10);
});

test('three blanks can supply three As at a crossing but cannot supply a fourth', () => {
  const rack = 'ZZZZZZZZZ???';
  const result = solveRack(rack, ['AA'], shapes);
  validate(result, rack, new Set(['AA']));
  assert.equal(result.score, 4);
  assert.equal(result.blankIndices.length, 3);
  assert.equal(result.cells.length, 3);
  assert.equal(result.unused.length, 9);
});

test('unused blanks remain available when no allowed word needs them', () => {
  const result = solveRack('ZZZZZZZZZZ??', [], shapes);
  validate(result, 'ZZZZZZZZZZ??', new Set());
  assert.deepEqual(result.blankIndices, []);
  assert.equal(result.unused.filter(c => c === '?').length, 2);
});

test('allowlist affects only two-letter words, not substrings of longer words', () => {
  const result = prepareDictionary('AA\nAB\nQI\nAARDVARK\nQIS\n', ' ab\r\n# my words\r\nAB\r\n', 'QIS\n');
  assert.deepEqual(result, ['AB', 'AARDVARK', 'QIS']);
  assert.deepEqual(prepareDictionary('AA\nQIS\n', '', 'QIS'), ['QIS']);
  assert.throws(() => prepareDictionary('AA\n', 'ZZ', ''), /line 1/);
  assert.throws(() => prepareDictionary('AA\n', 'AA\nCAT', ''), /line 2/);
});

test('removing QI from the allowlist excludes it from actual solutions', () => {
  const filtered = prepareDictionary('QI\nAA\nAARDVARK\n', 'AA\n', '');
  const result = solveRack('QQQQQQQQQQQI', filtered, shapes);
  assert.equal(result.score, 0);
  assert.deepEqual(result.words, []);
});

test('three-letter list filters whole words independently, retaining longer words', () => {
  const text = 'AT\nCAT\nACT\nCATS\nSCAT\n';
  assert.deepEqual(prepareDictionary(text, 'AT', ' act\r\n# keep this one\r\nACT\r\n'), ['AT', 'ACT', 'CATS', 'SCAT']);
  assert.deepEqual(prepareDictionary(text, 'AT', ''), ['AT', 'CATS', 'SCAT']);
  assert.deepEqual(prepareDictionary(text, '', ''), ['CATS', 'SCAT']);
  assert.throws(() => prepareDictionary(text, 'AT', 'XYZ'), /three-letter-words.txt, line 1/);
  assert.throws(() => prepareDictionary(text, 'AT', 'CAT\nAT'), /three-letter-words.txt, line 2/);
});

test('removing CAT prevents its use by the solver while keeping allowed AT', () => {
  const filtered = prepareDictionary('AT\nCAT\nCATS\n', 'AT', '');
  const rack = 'CATZZZZZZZZZ';
  const result = solveRack(rack, filtered, shapes);
  validate(result, rack, new Set(filtered));
  assert.equal(result.score, 3);
  assert.deepEqual(result.words, ['AT']);
});

test('removing a three-letter word keeps longer words containing it, with blanks', () => {
  const filtered = prepareDictionary('AT\nCAT\nCATS\n', '', '');
  const rack = 'CATZZZZZZZZ?';
  const result = solveRack(rack, filtered, shapes);
  validate(result, rack, new Set(filtered));
  assert.equal(result.score, 5);
  assert.deepEqual(result.words, ['CATS']);
  assert.equal(result.letters[result.blankIndices[0]], 'S');
});

test('checked-in editable lists contain only valid SOWPODS words', () => {
  const pairs = readFileSync(new URL('../data/two-letter-words.txt', import.meta.url), 'utf8');
  const triples = readFileSync(new URL('../data/three-letter-words.txt', import.meta.url), 'utf8');
  const filtered = prepareDictionary(dictionary.join('\n'), pairs, triples);
  for (const word of filtered.filter(w => w.length <= 3)) assert.ok(words.has(word));
});

function mainWord(result) {
  const slot = getSlots(result.cells).find(s => s.length === result.longest && result.cells[s[1]] - result.cells[s[0]] === 1);
  return slot ? slot.map(i => result.letters[i]).join('') : '';
}

test('successive rejections exclude every rejected word from results and progress candidates', () => {
  const rack = 'AEINORSTATED';
  const rejected = [];
  let result = solveRack(rack, dictionary, shapes);
  for (let attempt = 0; attempt < 3; attempt++) {
    rejected.push(mainWord(result));
    const updates = [];
    result = solveRack(rack, dictionary, shapes, update => updates.push(update), rejected);
    validate(result, rack);
    assert.equal(result.optimal, true);
    assert.ok(result.words.length);
    for (const candidate of [result, ...updates.filter(u => u.type === 'best').map(u => u.result)]) {
      for (const word of rejected) assert.ok(!candidate.words.includes(word), `${word} must remain rejected`);
    }
  }
  // Retrying without exclusions restores the original deterministic solution.
  assert.equal(mainWord(solveRack(rack, dictionary, shapes)), rejected[0]);
});

test('rejection works with two blanks and leaves dictionary inputs unchanged', () => {
  const rack = 'AEINORSTAT??';
  const first = solveRack(rack, dictionary, shapes);
  const rejected = [mainWord(first)];
  const result = solveRack(rack, dictionary, shapes, () => {}, rejected);
  validate(result, rack);
  assert.ok(!result.words.includes(rejected[0]));
  assert.equal(result.optimal, true);
  assert.deepEqual(rejected, [mainWord(first)]);
  assert.ok(dictionary.includes(rejected[0]));
});

test('rejecting every available word returns no solution rather than recycling a rejected word', () => {
  const rack = 'AAAAAAAAAAAA';
  const updates = [];
  const result = solveRack(rack, ['AA'], shapes, u => updates.push(u), ['AA']);
  validate(result, rack, new Set());
  assert.equal(result.score, 0);
  assert.equal(result.optimal, true);
  assert.equal(result.unused.length, 12);
  assert.equal(updates.length, 0);
});

test('rejections match whole words, preserving longer words with the same prefix', () => {
  const rack = 'CATZZZZZZZZ?';
  const result = solveRack(rack, ['CAT', 'CATS'], shapes, () => {}, ['CAT']);
  validate(result, rack, new Set(['CATS']));
  assert.deepEqual(result.words, ['CATS']);
});
