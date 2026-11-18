import { createTiles, moveTile, appendTile, getBoardBounds, getGridLayout, analyzeArrangement, getPlayMainWord } from './play-model.js';
import { RoundTimer } from './round-timer.js';

const $ = id => document.getElementById(id);

export class PlayBoard {
  constructor(onCheck) {
    this.onCheck = onCheck;
    this.revision = 0;
    this.tiles = [];
    this.selected = null;
    this.check = null;
    this.building = true;
    this.blankId = null;
    this.roundTimer = new RoundTimer(seconds => {
      $('play-timer').textContent = `${seconds}s`;
      $('play-timer').classList.toggle('expired', seconds === 0);
      $('play-timer').setAttribute('aria-label', seconds === 0 ? 'Time is up' : `${seconds} seconds remaining`);
    }, () => {
      this.timeExpired = true;
      this.requestCheck();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.roundTimer.tick(); });
    $('play-reset').onclick = () => this.reset(this.tiles.map(tile => tile.tile).join(''), { preserveTimer: true });
    $('play-check').onclick = () => this.requestCheck();
    $('return-tile').onclick = () => { if (this.selected !== null) this.place(this.selected, null, null); };
    for (const letter of 'QWERTYUIOPASDFGHJKLZXCVBNM') {
      const key = document.createElement('button');
      key.className = 'letter-key';
      key.textContent = letter;
      key.setAttribute('aria-label', `Set blank to ${letter}`);
      key.onpointerdown = () => { this.blankPointerKey = key; };
      key.onpointercancel = () => { this.blankPointerKey = null; };
      key.onclick = event => {
        // Ignore a delayed opening click unless a new press began on this key.
        if (event.detail > 0 && this.blankPointerKey !== key) return;
        this.blankPointerKey = null;
        const tile = this.tiles.find(item => item.id === this.blankId);
        $('blank-dialog').close();
        if (!tile) return;
        tile.letter = letter;
        if (tile.x === null && this.building) appendTile(this.tiles, tile.id);
        this.edited();
        this.render();
        this.focusTile(tile.id);
      };
      $('blank-keyboard').append(key);
    }
    $('blank-cancel').onclick = () => $('blank-dialog').close();
    $('blank-dialog').addEventListener('close', () => {
      if (this.blankId !== null) this.focusTile(this.blankId);
      this.blankId = null;
    });
    document.addEventListener('keydown', event => {
      if (!$('blank-dialog').open || event.ctrlKey || event.metaKey || event.altKey || !/^[a-z]$/i.test(event.key)) return;
      event.preventDefault();
      [...$('blank-keyboard').children].find(key => key.textContent === event.key.toUpperCase())?.click();
    });
    this.resizeObserver = new ResizeObserver(() => this.fitGrid());
    this.resizeObserver.observe($('play-board-frame'));
    window.addEventListener('resize', () => this.fitGrid());
    this.reset('');
  }

  reset(rack, { preserveTimer = false } = {}) {
    if (!preserveTimer) {
      this.active = false;
      this.roundTimer.reset();
      this.timeExpired = false;
    }
    this.cancelDrag();
    if ($('blank-dialog').open) $('blank-dialog').close();
    this.tiles = createTiles(rack);
    this.building = true;
    this.selected = null;
    this.edited();
    this.render();
  }

  startRound() {
    if (this.tiles.length !== 12) return;
    this.active = true;
    this.timeExpired = false;
    this.roundTimer.start();
    this.render();
  }

  stopTimer() {
    this.roundTimer.stop();
  }

  requestCheck() {
    if (!this.active || this.checking) return;
    this.cancelDrag();
    this.check = null;
    this.checking = true;
    this.render();
    this.onCheck(this.tiles.map(tile => ({ ...tile })), this.revision);
  }

  edited() {
    this.revision++;
    this.check = null;
    this.checking = false;
    this.message = '';
  }

  showCheck(result, revision) {
    if (revision !== this.revision) return;
    this.checking = false;
    this.check = result;
    this.render();
  }

  showError(message, revision) {
    if (revision !== this.revision) return;
    this.checking = false;
    this.message = message;
    this.render();
  }

  place(id, x, y) {
    if (!moveTile(this.tiles, id, x, y)) {
      this.message = 'That cell already has a tile. Choose an empty cell.';
      this.render();
      return;
    }
    this.building = false;
    this.selected = null;
    this.edited();
    this.render();
    this.focusTile(id);
  }

  tapTile(tile) {
    // Selecting any tile starts a new edit, clearing the last check's colours.
    this.edited();
    if (tile.tile === '?') {
      this.render();
      this.blankId = tile.id;
      this.blankPointerKey = null;
      $('blank-dialog').showModal();
      return;
    }
    if (this.building && tile.x === null) {
      appendTile(this.tiles, tile.id);
      this.selected = null;
    } else {
      this.building = false;
      this.selected = this.selected === tile.id ? null : tile.id;
    }
    this.render();
    this.focusTile(tile.id);
  }

  focusTile(id) {
    document.querySelector(`[data-play-tile="${id}"]`)?.focus({ preventScroll: true });
  }

  tileElement(tile) {
    const element = document.createElement('button');
    const checkedState = this.check && tile.x !== null ? this.check.invalidIds.includes(tile.id) ? ' invalid' : ' checked' : '';
    element.className = `play-tile${tile.tile === '?' ? ' play-blank' : ''}${this.selected === tile.id ? ' selected' : ''}${checkedState}`;
    element.dataset.playTile = tile.id;
    element.textContent = tile.letter || '?';
    element.setAttribute('aria-label', `${tile.tile === '?' ? `Blank, ${tile.letter || 'choose a letter'}` : tile.letter}, tile ${tile.id + 1}, ${tile.x === null ? 'in tray' : `column ${tile.x}, row ${tile.y}`}${this.check?.invalidIds.includes(tile.id) ? ', invalid arrangement' : ''}`);
    element.setAttribute('aria-pressed', String(this.selected === tile.id));
    const interaction = { dragged: false };
    element.onclick = () => { if (!interaction.dragged) this.tapTile(tile); };
    element.onkeydown = event => {
      const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (tile.x !== null && offsets[event.key]) {
        event.preventDefault();
        const [dx, dy] = offsets[event.key];
        this.place(tile.id, tile.x + dx, tile.y + dy);
      }
      if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); this.place(tile.id, null, null); }
    };
    element.onpointerdown = event => {
      interaction.dragged = false;
      this.pointerDown(event, tile, element, interaction);
    };
    return element;
  }

  pointerDown(event, tile, element, interaction) {
    if (!event.isPrimary || event.button !== 0 || this.drag) return;
    element.setPointerCapture(event.pointerId);
    const drag = { id: tile.id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moving: false, element, pointerId: event.pointerId };
    this.drag = drag;
    element.onpointermove = move => {
      drag.x = move.clientX;
      drag.y = move.clientY;
      if (!drag.moving && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 8) {
        drag.moving = true;
        interaction.dragged = true;
        this.edited();
        this.building = false;
        this.selected = null;
        for (const tile of document.querySelectorAll('.play-tile.invalid, .play-tile.checked')) tile.classList.remove('invalid', 'checked');
        this.renderPoints(analyzeArrangement(this.tiles).score);
        for (const word of $('play-words').children) {
          word.classList.remove('invalid', 'checked');
          word.textContent = word.textContent.replace(/ [×✓]$/, '');
        }
        $('play-status').textContent = 'Moving a tile…';
        $('play-status').className = 'play-status';
        const ghost = element.cloneNode(true);
        ghost.removeAttribute('data-play-tile');
        ghost.removeAttribute('id');
        ghost.className = 'play-tile drag-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        document.body.append(ghost);
        drag.ghost = ghost;
        element.classList.add('drag-source');
      }
      if (drag.ghost) {
        drag.ghost.style.left = `${drag.x}px`;
        drag.ghost.style.top = `${drag.y}px`;
        this.showDropTarget(drag.x, drag.y);
      }
    };
    element.onpointerup = up => {
      const moving = drag.moving;
      const target = document.elementFromPoint(up.clientX, up.clientY);
      const cell = target?.closest('[data-cell]');
      const tray = target?.closest('#play-tray');
      this.cancelDrag();
      // A tap is handled by click, after pointerup completes. Opening the blank
      // dialog here lets the original tap land on a newly displayed letter key.
      if (!moving) return;
      if (cell) this.place(tile.id, Number(cell.dataset.x), Number(cell.dataset.y));
      else if (tray) this.place(tile.id, null, null);
      else { this.message = 'Drop onto an empty grid cell or back into the tray.'; this.render(); }
    };
    element.onpointercancel = () => { this.cancelDrag(); this.render(); };
    element.onlostpointercapture = () => { if (this.drag === drag) { this.cancelDrag(); this.render(); } };
  }

  showDropTarget(x, y) {
    document.querySelector('.drop-target')?.classList.remove('drop-target');
    const target = document.elementFromPoint(x, y)?.closest('[data-cell], #play-tray');
    target?.classList.add('drop-target');
  }

  fitGrid() {
    const frame = $('play-board-frame');
    if (!this.bounds || !frame.clientWidth) return;
    const style = getComputedStyle(frame);
    const width = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = Math.min(440, Math.max(160, window.innerHeight * 0.6));
    const { cell, gap } = getGridLayout(this.bounds, width, height);
    const grid = $('play-grid');
    grid.style.setProperty('--play-cell', `${cell}px`);
    grid.style.setProperty('--play-gap', `${gap}px`);
    grid.style.setProperty('--play-font', `${Math.min(22, cell * 0.5)}px`);
    grid.style.setProperty('--play-border', `${Math.min(1, cell / 20)}px`);
  }

  cancelDrag() {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    drag.ghost?.remove();
    drag.element.classList.remove('drag-source');
    document.querySelector('.drop-target')?.classList.remove('drop-target');
    if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
  }

  renderPoints(score) {
    $('play-potential').textContent = score;
    $('play-points').className = `play-points${this.check ? this.check.valid ? ' valid' : ' invalid' : ''}`;
    $('play-points').setAttribute('aria-label', `${score} ${this.check ? this.check.valid ? 'checked' : 'invalid arrangement, potential' : 'potential'} points`);
  }

  render() {
    const ready = this.active && this.tiles.length === 12;
    const mainWord = ready ? getPlayMainWord(this.tiles) : '';
    $('play-solve-main').disabled = this.solving || !mainWord;
    $('play-solve-main').title = mainWord ? `Keep ${mainWord} as the main word` : 'Build a horizontal main word first';
    $('play-solve-main').setAttribute('aria-label', mainWord ? `Solve with my main word: ${mainWord}` : 'Solve with my main word');
    $('play-content').hidden = !ready;
    $('play-empty').hidden = ready;
    $('play-empty').textContent = this.tiles.length === 12
      ? 'Your letters are ready. Tap Play above to start the countdown and reveal your tiles.'
      : 'Choose 12 letters above, then tap Play to build your crossword.';
    if (!ready) {
      this.bounds = null;
      $('play-tray').replaceChildren();
      $('play-grid').replaceChildren();
      return;
    }
    const analysis = analyzeArrangement(this.tiles);
    const bounds = getBoardBounds(this.tiles);
    this.bounds = bounds;
    const tray = $('play-tray');
    // Every physical tile keeps its own slot, including when it is on the board.
    // Returning a tile fills its original gap without moving its neighbours.
    tray.replaceChildren(...this.tiles.map(tile => {
      const slot = document.createElement('div');
      slot.className = 'play-tray-slot';
      if (tile.x === null) slot.append(this.tileElement(tile));
      else slot.setAttribute('aria-hidden', 'true');
      return slot;
    }));
    const grid = $('play-grid');
    grid.style.setProperty('--play-cols', bounds.maxX - bounds.minX + 1);
    const cells = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = document.createElement('div');
      cell.className = 'play-cell';
      cell.dataset.cell = '';
      cell.dataset.x = x;
      cell.dataset.y = y;
      const tile = this.tiles.find(item => item.x === x && item.y === y);
      if (tile) cell.append(this.tileElement(tile));
      else {
        const button = document.createElement('button');
        button.className = 'place-tile';
        button.disabled = this.selected === null;
        button.setAttribute('aria-label', `Place selected tile at column ${x}, row ${y}`);
        button.onclick = () => { if (this.selected !== null) this.place(this.selected, x, y); };
        cell.append(button);
      }
      cells.push(cell);
    }
    grid.replaceChildren(...cells);
    this.fitGrid();
    this.renderPoints(analysis.score);
    $('play-breakdown').textContent = `${analysis.longest} longest + ${analysis.words.length} words + ${analysis.bonus} all-tiles bonus · ${analysis.used} / 12 tiles on board`;
    $('play-hint').textContent = this.building
      ? 'Tap tray tiles in word order to build your horizontal word. Then start dragging.'
      : 'Drag tiles to an empty cell or the tray. You can also select a tile, then tap an empty cell. Tap a blank to set its letter.';
    $('play-reset').disabled = !analysis.used && !this.tiles.some(tile => tile.tile === '?' && tile.letter);
    $('play-check').disabled = !analysis.used || this.checking;
    $('play-check').textContent = this.checking ? 'Checking…' : 'Check';
    $('return-tile').hidden = this.selected === null;
    $('play-words').replaceChildren(...analysis.words.map(word => {
      const chip = document.createElement('span');
      const invalid = this.check?.invalidWords.some(item => item.direction === word.direction && item.ids.join(',') === word.ids.join(','));
      chip.className = `play-word${invalid ? ' invalid' : this.check ? ' checked' : ''}`;
      chip.textContent = `${word.text}${invalid ? ' ×' : this.check ? ' ✓' : ''}`;
      return chip;
    }));
    $('play-status').className = `play-status${this.check ? this.check.valid ? ' valid' : ' invalid' : ''}`;
    $('play-status').textContent = (this.timeExpired ? 'Time’s up! You can keep arranging. ' : '') + (this.message || (this.checking ? 'Checking SOWPODS and the two- and three-letter lists…' : this.check
      ? this.check.valid ? `All words valid · ${this.check.score} points.${analysis.unused ? ` ${analysis.unused} tiles still in the tray.` : ' All 12 tiles used!'} Keep arranging to try for more.` : this.check.issues.join(' ')
      : 'Potential score only. Check words when you’re ready.'));
  }
}
