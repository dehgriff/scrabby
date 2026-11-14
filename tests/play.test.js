import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createTiles, moveTile, appendTile, getBoardBounds, getGridLayout, analyzeArrangement, checkArrangement } from '../play-model.js';
import { prepareDictionary, prepareCommonDictionary } from '../dictionary.js';
import { solveRack } from '../solver.js';

function arrange(rack, coordinates) {
  const tiles = createTiles(rack);
  coordinates.forEach(([x, y], id) => assert.equal(moveTile(tiles, id, x, y), true));
  return tiles;
}

test('quick entry preserves physical repeated tiles and appends a horizontal word', () => {
  const tiles = createTiles('LETTER????AB');
  for (const id of [0, 1, 2, 3, 4, 5]) assert.equal(appendTile(tiles, id), true);
  assert.deepEqual(tiles.slice(0, 6).map(tile => [tile.letter, tile.x, tile.y]), [...'LETTER'].map((letter, x) => [letter, x, 0]));
  assert.equal(new Set(tiles.map(tile => tile.id)).size, 12);
  assert.equal(tiles.filter(tile => tile.x === null).length, 6);
});

test('moves refuse overlap and malformed coordinates; returning to the tray keeps blank assignment', () => {
  const tiles = arrange('A?', [[0, 0], [1, 0]]);
  tiles[1].letter = 'T';
  assert.equal(moveTile(tiles, 1, 0, 0), false);
  assert.equal(moveTile(tiles, 1, 0.5, 1), false);
  assert.equal(moveTile(tiles, 1, null, 0), false);
  assert.equal(moveTile(tiles, 99, 0, 0), false);
  assert.equal(moveTile(tiles, 1, null, null), true);
  assert.equal(tiles[1].letter, 'T');
  assert.equal(tiles[1].tile, '?');
  assert.equal(moveTile(tiles, 1, -1, 0), true);
  assert.equal(analyzeArrangement(tiles).words[0].text, 'TA');
});

test('crossings read across and down and count their shared tile only once', () => {
  const tiles = arrange('CATAXXXXXXXX', [[0, 0], [1, 0], [2, 0], [2, -1]]);
  const analysis = analyzeArrangement(tiles);
  assert.deepEqual(analysis.words.map(word => word.text).sort(), ['AT', 'CAT']);
  assert.equal(analysis.used, 4);
  assert.equal(analysis.score, 5);
  assert.equal(analysis.connected, true);
  assert.equal(checkArrangement(tiles, new Set(['CAT', 'AT'])).valid, true);
});

test('duplicate word placements count separately and single-letter runs do not count', () => {
  const tiles = arrange('AAAA', [[0, 0], [1, 0], [0, 1], [1, 1]]);
  const analysis = analyzeArrangement(tiles);
  assert.equal(analysis.words.length, 4);
  assert.equal(analysis.score, 6);
  assert.equal(checkArrangement(tiles, new Set(['AA'])).valid, true);
});

test('a blank shares one chosen letter across both crossing words', () => {
  const tiles = arrange('C?TOT', [[0, 0], [1, 0], [2, 0], [1, -1], [1, 1]]);
  tiles[1].letter = 'A';
  const checked = checkArrangement(tiles, new Set(['CAT', 'OAT']));
  assert.equal(checked.valid, true);
  assert.deepEqual(checked.words.map(word => word.text).sort(), ['CAT', 'OAT']);
  tiles[1].letter = 'U';
  const edited = checkArrangement(tiles, new Set(['CAT', 'OAT']));
  assert.equal(edited.valid, false);
  assert.deepEqual(edited.invalidWords.map(word => word.text).sort(), ['CUT', 'OUT']);
  assert.ok(edited.invalidIds.includes(1));
});

test('unassigned board blanks fail checking, but unassigned tray blanks are allowed', () => {
  const tiles = arrange('A??', [[0, 0], [1, 0]]);
  assert.deepEqual(analyzeArrangement(tiles).unassigned, [1]);
  assert.equal(checkArrangement(tiles, new Set(['AT'])).valid, false);
  tiles[1].letter = 'T';
  assert.equal(checkArrangement(tiles, new Set(['AT'])).valid, true);
});

test('invalid words highlight exactly their tiles, including a shared crossing', () => {
  const tiles = arrange('CATZ', [[0, 0], [1, 0], [2, 0], [2, -1]]);
  const checked = checkArrangement(tiles, new Set(['CAT']));
  assert.deepEqual(checked.invalidWords.map(word => word.text), ['ZT']);
  assert.deepEqual([...checked.invalidIds].sort(), [2, 3]);
  assert.equal(checked.score, 5); // Potential score is independent of word validity.
});

test('disconnected valid words and isolated tiles fail structural validation', () => {
  const tiles = arrange('ATAT', [[0, 0], [1, 0], [0, 2], [1, 2]]);
  const checked = checkArrangement(tiles, new Set(['AT']));
  assert.equal(checked.valid, false);
  assert.equal(checked.invalidWords.length, 0);
  assert.equal(checked.connected, false);
  assert.match(checked.issues.join(' '), /Connect/);
  moveTile(tiles, 3, 5, 5);
  assert.deepEqual(analyzeArrangement(tiles).isolated.sort(), [2, 3]);
});

test('empty and single-tile boards score zero and cannot pass a check', () => {
  const tiles = createTiles('ABCDEFGHIJKL');
  assert.equal(analyzeArrangement(tiles).score, 0);
  assert.equal(checkArrangement(tiles, new Set()).valid, false);
  moveTile(tiles, 0, 0, 0);
  assert.equal(analyzeArrangement(tiles).score, 0);
  assert.equal(checkArrangement(tiles, new Set(['A'])).valid, false);
});

test('all-tile bonus requires all twelve tiles to be connected', () => {
  const tiles = arrange('AAAAAAAAAAAA', Array.from({ length: 12 }, (_, x) => [x, 0]));
  assert.equal(analyzeArrangement(tiles).bonus, 1);
  moveTile(tiles, 11, 20, 20);
  assert.equal(analyzeArrangement(tiles).bonus, 0);
  moveTile(tiles, 11, null, null);
  assert.equal(analyzeArrangement(tiles).bonus, 0);
});

test('the grid has a minimum area and an empty border on every side, including negative coordinates', () => {
  for (const coordinates of [[], [[0, 0]], [[-4, -8], [9, 6]], [[10, 10], [11, 10]]]) {
    const tiles = arrange('AB', coordinates);
    const bounds = getBoardBounds(tiles);
    assert.ok(bounds.maxX - bounds.minX + 1 >= 7);
    assert.ok(bounds.maxY - bounds.minY + 1 >= 5);
    for (const [x, y] of coordinates) {
      assert.ok(x > bounds.minX && x < bounds.maxX);
      assert.ok(y > bounds.minY && y < bounds.maxY);
    }
  }
});

test('grid fitting keeps every cell visible across narrow, wide and tall arrangements', () => {
  for (const [columns, rows] of [[7, 5], [14, 5], [7, 14], [25, 30], [50, 5]]) {
    for (const [width, height] of [[240, 160], [283, 396], [700, 440], [480, 180]]) {
      const { cell, gap } = getGridLayout({ minX: -3, maxX: columns - 4, minY: -5, maxY: rows - 6 }, width, height);
      assert.ok(cell > 0 && cell <= 44);
      assert.ok(gap > 0 && gap <= 3);
      assert.ok(columns * cell + (columns - 1) * gap <= width + 1e-8);
      assert.ok(rows * cell + (rows - 1) * gap <= height + 1e-8);
      assert.ok(Math.abs(cell / gap - 44 / 3) < 1e-8);
    }
  }
});

const read = file => readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8');
const dictionary = prepareDictionary(gunzipSync(readFileSync(new URL('../data/sowpods.txt.gz', import.meta.url))).toString(), read('two-letter-words.txt'), read('three-letter-words.txt'));

test('play checks SOWPODS and the editable short lists without applying the common-word filter', () => {
  const common = new Set(prepareCommonDictionary(dictionary, read('common-words.txt')));
  assert.equal(common.has('DETENT'), false);
  assert.equal(checkArrangement(arrange('DETENT', [...'DETENT'].map((_, x) => [x, 0])), new Set(dictionary)).valid, true);
  const restricted = prepareDictionary('AT QI CAT DETENT', 'AT', 'CAT');
  assert.equal(checkArrangement(arrange('QI', [[0, 0], [1, 0]]), new Set(restricted)).valid, false);
  assert.equal(checkArrangement(arrange('AT', [[0, 0], [1, 0]]), new Set(restricted)).valid, true);
  const custom = new Set(prepareDictionary('AT\nCAT\n', 'IE', 'XYZ'));
  assert.equal(checkArrangement(arrange('IE', [[0, 0], [1, 0]]), custom).valid, true);
  assert.equal(checkArrangement(arrange('XYZ', [[0, 0], [1, 0], [2, 0]]), custom).valid, true);
  assert.equal(checkArrangement(arrange('AT', [[0, 0], [1, 0]]), custom).valid, false);
  assert.equal(checkArrangement(arrange('CAT', [[0, 0], [1, 0], [2, 0]]), custom).valid, false);
});

test('play independently reproduces solver scores and valid physical blank assignments', () => {
  const shapes = new Uint8Array(gunzipSync(readFileSync(new URL('../data/shapes.bin.gz', import.meta.url))));
  for (const rack of ['AEINORSTATED', 'AEINORST????']) {
    const result = solveRack(rack, dictionary, shapes);
    const tiles = createTiles(rack);
    const available = [...tiles];
    result.cells.forEach((p, i) => {
      const physical = result.blankIndices.includes(i) ? '?' : result.letters[i];
      const index = available.findIndex(tile => tile.tile === physical);
      assert.ok(index >= 0);
      const [tile] = available.splice(index, 1);
      tile.letter = result.letters[i];
      moveTile(tiles, tile.id, p % 16, Math.floor(p / 16));
    });
    const checked = checkArrangement(tiles, new Set(dictionary));
    assert.equal(checked.valid, true);
    assert.equal(checked.score, result.score);
    assert.equal(checked.longest, result.longest);
    assert.equal(checked.words.length, result.words.length);
  }
});
