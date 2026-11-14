// Physical letter counts supplied for the Scrabble Speed tower set.
export const TILE_COUNTS = Object.freeze({
  A: 7, B: 2, C: 2, D: 3, E: 10, F: 2, G: 2, H: 2, I: 7,
  K: 1, L: 3, M: 2, N: 5, O: 6, P: 2, R: 5, S: 3, T: 5,
  U: 3, V: 2, W: 2, Y: 2, '?': 4,
});

export const TOTAL_TILES = Object.values(TILE_COUNTS).reduce((total, count) => total + count, 0);

export function drawTiles(count = 12, random = Math.random) {
  if (!Number.isInteger(count) || count < 0 || count > TOTAL_TILES) {
    throw new RangeError(`Draw between 0 and ${TOTAL_TILES} tiles.`);
  }
  // Each call starts with a full bag. A partial Fisher–Yates shuffle samples
  // physical tiles uniformly without replacement, respecting letter counts.
  const bag = Object.entries(TILE_COUNTS).flatMap(([letter, copies]) => Array(copies).fill(letter));
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (bag.length - i));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, count);
}
