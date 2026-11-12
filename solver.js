// Exact search: all connected shapes, in descending score order. Transposition
// preserves reading direction, so each shape and its transpose need only one entry.
export function getSlots(cells) {
  const index = new Map(Array.from(cells, (p, i) => [p, i]));
  const slots = [];
  for (const p of cells) {
    for (const step of [1, 16]) {
      if (!index.has(p - step) && index.has(p + step)) {
        const slot = [];
        for (let q = p; index.has(q); q += step) slot.push(index.get(q));
        slots.push(slot);
      }
    }
  }
  return slots;
}

export function scoreBoard(cells, letters) {
  const words = getSlots(cells).map(slot => slot.map(i => letters[i]).join(''));
  const longest = Math.max(0, ...words.map(w => w.length));
  const bonus = cells.length === 12 ? 1 : 0;
  return { score: longest + words.length + bonus, longest, bonus, words };
}

export function solveRack(rack, dictionary, shapes, report = () => {}, rejectedWords = []) {
  if (!/^[A-Z?]{12}$/.test(rack)) throw new Error('Choose exactly 12 letters or blanks.');
  const blanks = [...rack].filter(ch => ch === '?').length;
  if (blanks > 2) throw new Error('Choose at most two blank tiles.');
  const counts = new Int8Array(26);
  for (const ch of rack) if (ch !== '?') counts[ch.charCodeAt(0) - 65]++;
  const byLength = Array.from({ length: 13 }, () => []);
  const needed = new Int8Array(26);
  const rejected = new Set(rejectedWords);
  for (const word of dictionary) {
    if (word.length < 2 || word.length > 12 || rejected.has(word)) continue;
    needed.fill(0);
    let valid = true;
    let missing = 0;
    for (let i = 0; i < word.length; i++) {
      const c = word.charCodeAt(i) - 65;
      if (++needed[c] > counts[c] && ++missing > blanks) { valid = false; break; }
    }
    if (valid) byLength[word.length].push(Uint8Array.from(word, c => c.charCodeAt(0) - 64));
  }
  const positional = byLength.map(words => {
    if (!words.length) return [];
    const index = Array.from({ length: words[0].length }, () => Array.from({ length: 27 }, () => []));
    for (const word of words) for (let p = 0; p < word.length; p++) index[p][word[p]].push(word);
    return index;
  });

  function result(cells, assigned, optimal, checked) {
    cells = Array.from(cells);
    const slots = getSlots(cells);
    const longest = Math.max(...slots.map(slot => slot.length));
    const horizontalLongest = slots.some(slot => slot.length === longest && cells[slot[1]] - cells[slot[0]] === 1);
    // Swap rows and columns if necessary. This preserves word reading order,
    // score, tile indices and blank assignments, while putting a longest word across.
    if (!horizontalLongest) cells = cells.map(p => (p % 16) * 16 + Math.floor(p / 16));
    const letters = Array.from(assigned, n => String.fromCharCode(n + 64));
    const used = [...rack];
    const blankIndices = [];
    for (let i = 0; i < letters.length; i++) {
      let index = used.indexOf(letters[i]);
      if (index === -1) { index = used.indexOf('?'); blankIndices.push(i); }
      used.splice(index, 1);
    }
    return { cells: Array.from(cells), letters, blankIndices, ...scoreBoard(cells, letters), unused: used, optimal, checked };
  }

  let best = null;
  for (let length = 12; length >= 2; length--) {
    if (!byLength[length].length) continue;
    best = result(Uint8Array.from({ length }, (_, i) => i), byLength[length][0], false, 0);
    report({ type: 'best', result: best });
    break;
  }
  // If no rack word exists, no connected arrangement with >=2 tiles exists.
  if (!best) return { cells: [], letters: [], blankIndices: [], score: 0, longest: 0, bonus: 0, words: [], unused: [...rack], optimal: true, checked: 0 };

  const remaining = counts.slice();
  let remainingBlanks = blanks;
  let checked = 0;
  let lastReport = performance.now();
  for (let offset = 0; offset < shapes.length;) {
    const size = shapes[offset++];
    const score = shapes[offset++];
    const cells = shapes.subarray(offset, offset + size);
    offset += size;
    if (score <= best.score) return { ...best, optimal: true, checked };
    checked++;
    const slots = getSlots(cells);
    if (slots.some(s => !byLength[s.length].length)) continue;
    if (performance.now() - lastReport > 250) {
      report({ type: 'progress', score, checked });
      lastReport = performance.now();
    }
    const assigned = new Uint8Array(size);
    const done = new Uint8Array(slots.length);

    function fits(word, slot) {
      // Count only newly occupied cells; a crossing spends its tile just once.
      needed.fill(0);
      let missing = 0;
      for (let p = 0; p < slot.length; p++) {
        const existing = assigned[slot[p]];
        if (existing) {
          if (existing !== word[p]) return false;
        } else if (++needed[word[p]-1] > remaining[word[p]-1] && ++missing > remainingBlanks) return false;
      }
      return true;
    }

    function search(depth) {
      if (depth === slots.length) return true;
      let selected = -1;
      let candidates = null;
      for (let s = 0; s < slots.length; s++) {
        if (done[s]) continue;
        const slot = slots[s];
        let pool = byLength[slot.length];
        for (let p = 0; p < slot.length; p++) {
          const ch = assigned[slot[p]];
          if (ch && positional[slot.length][p][ch].length < pool.length) pool = positional[slot.length][p][ch];
        }
        const matches = [];
        for (const word of pool) {
          if (fits(word, slot)) matches.push(word);
          if (candidates && matches.length >= candidates.length) break;
        }
        if (!matches.length) return false;
        if (!candidates || matches.length < candidates.length) { selected = s; candidates = matches; }
        if (candidates.length === 1) break;
      }
      const slot = slots[selected];
      done[selected] = 1;
      for (const word of candidates) {
        const added = [];
        for (let p = 0; p < slot.length; p++) {
          const i = slot[p];
          if (!assigned[i]) {
            const isBlank = remaining[word[p]-1] === 0;
            assigned[i] = word[p];
            if (isBlank) remainingBlanks--;
            else remaining[word[p]-1]--;
            added.push([i, isBlank]);
          }
        }
        if (search(depth + 1)) return true;
        for (const [i, isBlank] of added) {
          if (isBlank) remainingBlanks++;
          else remaining[assigned[i]-1]++;
          assigned[i] = 0;
        }
      }
      done[selected] = 0;
      return false;
    }
    if (search(0)) return result(cells, assigned, true, checked);
  }
  return { ...best, optimal: true, checked };
}
