import { getSlots, MAX_BLANKS } from './solver.js';
import { drawTiles } from './tile-bag.js';
import { PlayBoard } from './play.js';

const $ = id => document.getElementById(id);
let rack = [];
let worker;
let busy = false;
let best = null;
let mainWord = '';
let commonWords = false;
const rejectedWords = new Set();
let started = 0;
let timer;
let scrollToResult = true;
let progress = 'Searching the highest-scoring shapes';
const playBoard = new PlayBoard((tiles, revision) => {
  if (busy) stopSearch();
  if (!worker) createWorker();
  worker.postMessage({ type: 'check', tiles, revision });
});

function createWorker() {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') $('device-status').textContent = 'SOWPODS ready';
    if (data.type === 'checked') playBoard.showCheck(data.result, data.revision);
    if (data.type === 'check-error') playBoard.showError(data.message, data.revision);
    if (data.type === 'best') { best = data.result; renderResult(best); }
    if (data.type === 'progress') progress = `Checking ${data.score}-point arrangements`;
    if (data.type === 'result') {
      best = data.result;
      finish();
      renderResult(best);
      $('search-status').textContent = best.words.length
        ? `Proven optimal · ${((performance.now() - started) / 1000).toFixed(1)}s · ${commonWords ? 'common words + your short-word lists' : 'SOWPODS with your word lists'}`
        : commonWords ? 'No solution with the current common-word list and rejections. Try Use SOWPODS or Reset rejections.' : rejectedWords.size ? 'No valid words remain with these rejections. Reset rejections to try the full list again.' : 'No valid word can be made with these letters. Try a different rack.';
      if (scrollToResult && matchMedia('(max-width: 640px), (orientation: landscape) and (max-height: 600px)').matches) {
        document.querySelector('.result-panel').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    }
    if (data.type === 'error') fail(data.message);
  };
  worker.onerror = () => fail('The solver could not start. Reload the page in a recent version of Safari, Chrome or Firefox.');
}

function fail(message) {
  if (playBoard.checking) playBoard.showError(message, playBoard.revision);
  finish();
  $('error').textContent = message;
  $('error').hidden = false;
  $('search-status').textContent = 'Search interrupted. Tap Find best arrangement to retry.';
  $('device-status').textContent = 'Solver needs a retry';
  worker?.terminate();
  worker = null;
}

function finish() {
  busy = false;
  clearInterval(timer);
  $('search-status').classList.remove('searching');
  document.querySelector('.result-panel').setAttribute('aria-busy', 'false');
  renderInput();
}

function resetResult() {
  document.querySelector('.result-panel').style.minHeight = '';
  best = null;
  mainWord = '';
  $('reject').disabled = true;
  $('reject-common').disabled = true;
  $('solution').hidden = true;
  $('empty-state').hidden = false;
  $('result-badge').textContent = 'THE POSSIBILITIES AWAIT';
  $('result-badge').className = 'result-badge';
  $('search-status').textContent = '';
  $('error').hidden = true;
}

function stopSearch() {
  if (!busy) return;
  worker.terminate();
  worker = null;
  finish();
  if (best) renderResult(best);
  $('search-status').textContent = best ? 'Search stopped · best found so far. Tap Find best arrangement to prove the optimum.' : 'Search stopped. Tap Find best arrangement to try again.';
}

function persist() {
  try { localStorage.setItem('scrabby-rack', rack.join('')); } catch { /* Storage may be disabled. */ }
}

function changeRack(next) {
  if (busy) stopSearch();
  rack = next;
  playBoard.reset(rack.join(''));
  commonWords = false;
  rejectedWords.clear();
  renderRejections();
  persist();
  resetResult();
  renderInput();
}

function addLetter(letter) {
  if (letter === '?' && rack.filter(ch => ch === '?').length >= MAX_BLANKS) return;
  if (rack.length < 12) changeRack([...rack, letter]);
}

function renderInput() {
  $('rack').replaceChildren(...Array.from({ length: 12 }, (_, i) => {
    const tile = document.createElement('button');
    tile.className = `rack-tile${rack[i] ? ' filled' : ''}${rack[i] === '?' ? ' blank-rack-tile' : ''}`;
    tile.textContent = rack[i] || '+';
    tile.disabled = !rack[i];
    tile.setAttribute('aria-label', rack[i] ? `Remove ${rack[i] === '?' ? 'blank' : rack[i]}, tile ${i + 1}` : `Empty tile ${i + 1}`);
    tile.onclick = () => changeRack(rack.filter((_, n) => n !== i));
    return tile;
  }));
  $('letter-count').textContent = rack.length;
  for (const key of $('keyboard').children) key.disabled = rack.length === 12;
  const blanks = rack.filter(ch => ch === '?').length;
  $('blank').disabled = rack.length === 12 || blanks >= MAX_BLANKS;
  $('blank-count').textContent = `${blanks} / ${MAX_BLANKS} blanks used`;
  $('clear').disabled = rack.length === 0;
  $('solve').disabled = !busy && rack.length !== 12;
  $('solve-label').textContent = busy ? 'Stop search' : rack.length === 12 ? 'Solve' : `Choose ${12 - rack.length} ${rack.length === 11 ? 'more letter' : 'letters'}`;
  $('solve-icon').textContent = busy ? '□' : '↗';
  $('input-hint').textContent = busy ? 'Working entirely on your device' : rack.length === 12 ? 'Play first, or reveal the best arrangement' : 'Draw 12 letters or choose your own';
  $('play').disabled = rack.length !== 12;
  $('play-solve').disabled = rack.length !== 12;
  $('play-solve').textContent = busy ? 'Show solver' : 'Solve this rack';
  $('reject').disabled = busy || !best || !mainWord;
  $('reject-common').disabled = busy || !best || !mainWord;
  $('reject-common').hidden = commonWords;
  $('dictionary-label').textContent = commonWords ? 'Common words (4+ letters)' : 'SOWPODS';
  $('use-sowpods').hidden = !commonWords;
  $('use-sowpods').disabled = busy;
  $('reset-rejections').disabled = busy || !rejectedWords.size;
}

function renderRejections() {
  $('rejections').hidden = !rejectedWords.size;
  $('rejected-words').textContent = `Rejected for this rack: ${[...rejectedWords].join(', ')}`;
}

function rejectMainWord(useCommonWords = false) {
  if (busy || !best || !mainWord) return;
  rejectedWords.add(mainWord);
  if (useCommonWords) commonWords = true;
  renderRejections();
  solve({ preserveView: true });
}

function solve({ preserveView = false } = {}) {
  if (rack.length !== 12 || busy) return;
  scrollToResult = !preserveView;
  if (preserveView) {
    // Keep the previous board and panel height while replacing this result.
    // Collapsing it would clamp the page's scroll position on small screens.
    const panel = document.querySelector('.result-panel');
    panel.style.minHeight = `${panel.getBoundingClientRect().height}px`;
  }
  if (!worker) createWorker();
  busy = true;
  started = performance.now();
  best = null;
  progress = 'Searching the highest-scoring shapes';
  $('error').hidden = true;
  $('search-status').classList.add('searching');
  $('search-status').textContent = 'Preparing your letters…';
  $('result-badge').textContent = 'FINDING YOUR BEST MOVE';
  $('result-badge').className = 'result-badge';
  document.querySelector('.result-panel').setAttribute('aria-busy', 'true');
  timer = setInterval(() => {
    $('search-status').textContent = `${progress} · ${Math.floor((performance.now() - started) / 1000)}s`;
  }, 500);
  renderInput();
  worker.postMessage({ rack: rack.join(''), rejectedWords: [...rejectedWords], commonWords });
}

function renderResult(result) {
  $('empty-state').hidden = true;
  $('solution').hidden = false;
  $('score').textContent = result.score;
  $('longest-score').textContent = result.longest;
  $('words-score').textContent = result.words.length;
  $('bonus-score').textContent = result.bonus;
  $('solution-kicker').textContent = result.optimal ? 'PROVEN OPTIMAL' : 'BEST FOUND SO FAR';
  $('solution-title').textContent = result.score === 17 ? 'Twelve tiles. A perfect score.' : result.words.length ? 'Your letters, working together.' : 'These letters need a rethink.';
  $('result-badge').textContent = result.optimal ? '✓ OPTIMAL SOLUTION' : busy ? 'SEARCHING FOR MORE' : 'SEARCH STOPPED';
  $('result-badge').className = `result-badge${result.optimal ? ' optimal' : ''}`;
  const cols = Math.max(0, ...result.cells.map(p => p % 16)) + 1;
  $('board').style.setProperty('--cols', cols);
  $('board').style.setProperty('--board-width', `${cols * 43 + (cols - 1) * 4}px`);
  const slots = getSlots(result.cells);
  const longest = slots.find(slot => slot.length === result.longest && result.cells[slot[1]] - result.cells[slot[0]] === 1) || [];
  mainWord = longest.map(i => result.letters[i]).join('');
  $('reject').title = mainWord ? `Reject “${mainWord}” and find another solution` : 'Reject the highlighted main word';
  $('reject').disabled = busy || !mainWord;
  $('reject-common').title = mainWord ? `Reject “${mainWord}” and use common words of four or more letters` : 'Reject the highlighted word and use common words';
  $('reject-common').disabled = busy || !mainWord;
  const blankIndices = result.blankIndices || [];
  $('board').replaceChildren(...result.cells.map((p, i) => {
    const tile = document.createElement('span');
    const isBlank = blankIndices.includes(i);
    tile.className = `board-cell${longest.includes(i) ? ' longest' : ''}${isBlank ? ' blank' : ''}`;
    tile.textContent = result.letters[i];
    tile.style.setProperty('--x', p % 16 + 1);
    tile.style.setProperty('--y', Math.floor(p / 16) + 1);
    tile.setAttribute('aria-label', `${result.letters[i]}${isBlank ? ' (blank tile)' : ''}, row ${Math.floor(p / 16) + 1}, column ${p % 16 + 1}`);
    return tile;
  }));
  $('board').setAttribute('aria-label', `Crossword using ${result.cells.length} tiles. Words: ${result.words.join(', ') || 'none'}.`);
  const order = slots.map((slot, i) => ({ slot, word: result.words[i] })).sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
  $('words').replaceChildren(...order.map(({ slot, word }) => {
    const chip = document.createElement('button');
    chip.className = `word-chip${word.length === result.longest ? ' is-longest' : ''}`;
    chip.textContent = word;
    chip.setAttribute('aria-pressed', 'false');
    chip.onclick = () => {
      const active = chip.getAttribute('aria-pressed') !== 'true';
      for (const child of $('words').children) child.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-pressed', String(active));
      for (let i = 0; i < $('board').children.length; i++) $('board').children[i].classList.toggle('highlight', active && slot.includes(i));
    };
    return chip;
  }));
  $('unused').hidden = !result.unused.length;
  $('unused').textContent = `Unused tiles: ${result.unused.map(ch => ch === '?' ? '? (blank)' : ch).join(' · ')}`;
  $('blank-note').hidden = !blankIndices.length;
  $('blank-note').textContent = `Tiles marked ? are blanks: ${blankIndices.map(i => `? → ${result.letters[i]}`).join(', ')}.`;
}

for (const letter of 'QWERTYUIOPASDFGHJKLZXCVBNM') {
  const button = document.createElement('button');
  button.className = 'letter-key';
  button.textContent = letter;
  button.setAttribute('aria-label', `Add ${letter}`);
  button.onclick = () => addLetter(letter);
  $('keyboard').insertBefore(button, $('blank'));
}
$('clear').onclick = () => changeRack([]);
$('blank').onclick = () => addLetter('?');
$('solve').onclick = () => {
  if (busy) stopSearch();
  else {
    solve();
    document.querySelector('.result-panel').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
};
$('play').onclick = () => {
  if (busy) stopSearch();
  document.querySelector('.play-panel').scrollIntoView({ block: 'start', behavior: 'instant' });
};
$('play-solve').onclick = () => {
  if (!busy) solve();
  document.querySelector('.result-panel').scrollIntoView({ block: 'start', behavior: 'instant' });
};
$('reject').onclick = () => rejectMainWord();
$('reject-common').onclick = () => rejectMainWord(true);
$('use-sowpods').onclick = () => {
  if (busy) return;
  commonWords = false;
  solve({ preserveView: true });
};
$('reset-rejections').onclick = () => {
  if (busy) return;
  rejectedWords.clear();
  renderRejections();
  solve({ preserveView: true });
};
$('example').onclick = () => changeRack(drawTiles());
document.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if ($('blank-dialog').open) return;
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); addLetter(event.key.toUpperCase()); }
  if (event.key === '?') { event.preventDefault(); addLetter('?'); }
  if (event.key === 'Backspace' && rack.length) { event.preventDefault(); changeRack(rack.slice(0, -1)); }
  if (event.key === 'Escape') stopSearch();
});
try {
  const saved = localStorage.getItem('scrabby-rack') || '';
  if (/^[A-Z?]{0,12}$/.test(saved) && [...saved].filter(ch => ch === '?').length <= MAX_BLANKS) rack = [...saved];
} catch { /* The app works without local storage. */ }
renderInput();
playBoard.reset(rack.join(''));
createWorker();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* Plain HTTP on a LAN does not support offline installation. */ });
