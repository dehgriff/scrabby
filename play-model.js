// Coordinates are unrestricted integers; null coordinates mean a tile is in the tray.
export function createTiles(rack) {
  return [...rack].map((tile, id) => ({ id, tile, letter: tile === '?' ? '' : tile, x: null, y: null }));
}

export function moveTile(tiles, id, x, y) {
  const tile = tiles.find(item => item.id === id);
  if (!tile) return false;
  if (x === null && y === null) {
    tile.x = tile.y = null;
    return true;
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (tiles.some(item => item.id !== id && item.x === x && item.y === y)) return false;
  tile.x = x;
  tile.y = y;
  return true;
}

export function appendTile(tiles, id) {
  const placed = tiles.filter(tile => tile.x !== null);
  const x = placed.length ? Math.max(...placed.map(tile => tile.x)) + 1 : 0;
  return moveTile(tiles, id, x, 0);
}

export function getBoardBounds(tiles) {
  const placed = tiles.filter(tile => tile.x !== null);
  let minX = placed.length ? Math.min(...placed.map(tile => tile.x)) - 1 : -1;
  let maxX = placed.length ? Math.max(...placed.map(tile => tile.x)) + 1 : 5;
  let minY = placed.length ? Math.min(...placed.map(tile => tile.y)) - 1 : -2;
  let maxY = placed.length ? Math.max(...placed.map(tile => tile.y)) + 1 : 2;
  while (maxX - minX + 1 < 7) { maxX++; if (maxX - minX + 1 < 7) minX--; }
  while (maxY - minY + 1 < 5) { minY--; if (maxY - minY + 1 < 5) maxY++; }
  return { minX, maxX, minY, maxY };
}

export function analyzeArrangement(tiles) {
  const placed = tiles.filter(tile => tile.x !== null);
  const key = (x, y) => `${x},${y}`;
  const board = new Map(placed.map(tile => [key(tile.x, tile.y), tile]));
  const words = [];
  for (const tile of placed) {
    for (const [dx, dy, direction] of [[1, 0, 'across'], [0, 1, 'down']]) {
      if (board.has(key(tile.x - dx, tile.y - dy))) continue;
      const run = [];
      for (let x = tile.x, y = tile.y; board.has(key(x, y)); x += dx, y += dy) run.push(board.get(key(x, y)));
      if (run.length >= 2) words.push({ text: run.map(item => item.letter || '?').join(''), ids: run.map(item => item.id), direction });
    }
  }
  const seen = new Set();
  const pending = placed.length ? [placed[0]] : [];
  while (pending.length) {
    const tile = pending.pop();
    if (seen.has(tile.id)) continue;
    seen.add(tile.id);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const neighbour = board.get(key(tile.x + dx, tile.y + dy));
      if (neighbour && !seen.has(neighbour.id)) pending.push(neighbour);
    }
  }
  const connected = placed.length > 0 && seen.size === placed.length;
  const wordIds = new Set(words.flatMap(word => word.ids));
  const isolated = placed.filter(tile => !wordIds.has(tile.id)).map(tile => tile.id);
  const unassigned = placed.filter(tile => !/^[A-Z]$/.test(tile.letter)).map(tile => tile.id);
  const longest = Math.max(0, ...words.map(word => word.ids.length));
  const bonus = placed.length === 12 && connected ? 1 : 0;
  return { words, longest, bonus, score: longest + words.length + bonus, connected, isolated, unassigned, used: placed.length, unused: tiles.length - placed.length };
}

export function checkArrangement(tiles, dictionary) {
  const analysis = analyzeArrangement(tiles);
  const invalidWords = analysis.words.filter(word => !dictionary.has(word.text));
  const invalidIds = new Set([...invalidWords.flatMap(word => word.ids), ...analysis.unassigned, ...analysis.isolated]);
  const issues = [];
  if (!analysis.words.length) issues.push('Make at least one word of two or more letters.');
  if (analysis.used && !analysis.connected) {
    issues.push('Connect all board tiles edge to edge.');
    for (const tile of tiles) if (tile.x !== null) invalidIds.add(tile.id);
  }
  if (analysis.unassigned.length) issues.push('Choose a letter for every blank on the board.');
  if (invalidWords.length) issues.push(`Not in the allowed word lists: ${[...new Set(invalidWords.map(word => word.text))].join(', ')}.`);
  return { ...analysis, invalidWords, invalidIds: [...invalidIds], issues, valid: !issues.length };
}
