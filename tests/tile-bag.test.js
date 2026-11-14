import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_COUNTS, TOTAL_TILES, drawTiles } from '../tile-bag.js';

function counts(tiles) {
  return tiles.reduce((result, letter) => {
    result[letter] = (result[letter] || 0) + 1;
    return result;
  }, {});
}

test('the supplied tower distribution contains 78 letters and four blanks', () => {
  assert.equal(TOTAL_TILES, 82);
  assert.deepEqual(TILE_COUNTS, {
    A: 7, B: 2, C: 2, D: 3, E: 10, F: 2, G: 2, H: 2, I: 7,
    K: 1, L: 3, M: 2, N: 5, O: 6, P: 2, R: 5, S: 3, T: 5,
    U: 3, V: 2, W: 2, Y: 2, '?': 4,
  });
  assert.deepEqual(counts(drawTiles(82, () => 0.5)), TILE_COUNTS);
});

test('example draws contain 12 tiles and never exceed the physical counts', () => {
  let seed = 42;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  const racks = new Set();
  for (let i = 0; i < 100; i++) {
    const rack = drawTiles(12, random);
    assert.equal(rack.length, 12);
    for (const [letter, copies] of Object.entries(counts(rack))) {
      assert.ok(copies <= TILE_COUNTS[letter]);
    }
    assert.ok(rack.every(letter => !'JQXZ'.includes(letter)));
    racks.add(rack.join(''));
  }
  assert.ok(racks.size > 1);
});

test('each example uses a fresh bag, including repeated letters', () => {
  const expected = [...'AAAAAAABBCCD'];
  assert.deepEqual(drawTiles(12, () => 0), expected);
  assert.deepEqual(drawTiles(12, () => 0), expected);
  assert.deepEqual(drawTiles(0), []);
  for (const size of [-1, 83, 1.5]) assert.throws(() => drawTiles(size), RangeError);
});

test('an example can draw all four physical blanks, but no more', () => {
  let calls = 0;
  const rack = drawTiles(12, () => {
    const draw = calls++;
    // Select the four blank positions, then the next available letter tiles.
    return draw < 4 ? 78.5 / (82 - draw) : 0;
  });
  assert.equal(rack.filter(tile => tile === '?').length, 4);
});
