import { createTiles, moveTile, appendTile, getBoardBounds, analyzeArrangement } from './play-model.js';

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
    $('arrange-tiles').onclick = () => { this.building = false; this.selected = null; this.render(); };
    $('play-reset').onclick = () => this.reset(this.tiles.map(tile => tile.tile).join(''));
    $('play-check').onclick = () => {
      this.check = null;
      this.checking = true;
      this.render();
      this.onCheck(this.tiles.map(tile => ({ ...tile })), this.revision);
    };
    $('return-tile').onclick = () => { if (this.selected !== null) this.place(this.selected, null, null); };
    for (const letter of 'QWERTYUIOPASDFGHJKLZXCVBNM') {
      const key = document.createElement('button');
      key.className = 'letter-key';
      key.textContent = letter;
      key.setAttribute('aria-label', `Set blank to ${letter}`);
      key.onclick = () => {
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
    this.reset('');
  }

  reset(rack) {
    this.cancelDrag();
    if ($('blank-dialog').open) $('blank-dialog').close();
    this.tiles = createTiles(rack);
    this.building = true;
    this.selected = null;
    this.edited();
    $('play-content').hidden = this.tiles.length !== 12;
    $('play-empty').hidden = this.tiles.length === 12;
    this.render();
    $('play-board-scroll').scrollLeft = 0;
    $('play-board-scroll').scrollTop = 0;
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
    element.className = `play-tile${tile.tile === '?' ? ' play-blank' : ''}${this.selected === tile.id ? ' selected' : ''}${this.check?.invalidIds.includes(tile.id) ? ' invalid' : ''}`;
    element.dataset.playTile = tile.id;
    element.textContent = tile.letter || '?';
    element.setAttribute('aria-label', `${tile.tile === '?' ? `Blank, ${tile.letter || 'choose a letter'}` : tile.letter}, tile ${tile.id + 1}, ${tile.x === null ? 'in tray' : `column ${tile.x}, row ${tile.y}`}${this.check?.invalidIds.includes(tile.id) ? ', invalid arrangement' : ''}`);
    element.setAttribute('aria-pressed', String(this.selected === tile.id));
    element.onclick = event => { if (event.detail === 0) this.tapTile(tile); };
    element.onkeydown = event => {
      const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (tile.x !== null && offsets[event.key]) {
        event.preventDefault();
        const [dx, dy] = offsets[event.key];
        this.place(tile.id, tile.x + dx, tile.y + dy);
      }
      if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); this.place(tile.id, null, null); }
    };
    element.onpointerdown = event => this.pointerDown(event, tile, element);
    return element;
  }

  pointerDown(event, tile, element) {
    if (!event.isPrimary || event.button !== 0 || this.drag) return;
    element.setPointerCapture(event.pointerId);
    const drag = { id: tile.id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moving: false, element, pointerId: event.pointerId };
    this.drag = drag;
    element.onpointermove = move => {
      drag.x = move.clientX;
      drag.y = move.clientY;
      if (!drag.moving && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 8) {
        drag.moving = true;
        this.edited();
        this.building = false;
        this.selected = null;
        for (const red of document.querySelectorAll('.play-tile.invalid')) red.classList.remove('invalid');
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
        this.autoScroll();
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
      if (!moving) this.tapTile(tile);
      else if (cell) this.place(tile.id, Number(cell.dataset.x), Number(cell.dataset.y));
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

  autoScroll() {
    const drag = this.drag;
    if (!drag?.moving) return;
    const viewport = $('play-board-scroll');
    const rect = viewport.getBoundingClientRect();
    if (drag.y >= rect.top && drag.y <= rect.bottom && drag.x >= rect.left && drag.x <= rect.right) {
      const dx = drag.x < rect.left + 30 ? -6 : drag.x > rect.right - 30 ? 6 : 0;
      const dy = drag.y < rect.top + 30 ? -6 : drag.y > rect.bottom - 30 ? 6 : 0;
      viewport.scrollBy(dx, dy);
      this.showDropTarget(drag.x, drag.y);
    }
    this.dragFrame = requestAnimationFrame(() => this.autoScroll());
  }

  cancelDrag() {
    cancelAnimationFrame(this.dragFrame);
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    drag.ghost?.remove();
    drag.element.classList.remove('drag-source');
    document.querySelector('.drop-target')?.classList.remove('drop-target');
    if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
  }

  render() {
    const analysis = analyzeArrangement(this.tiles);
    const bounds = getBoardBounds(this.tiles);
    const tray = $('play-tray');
    tray.replaceChildren(...this.tiles.filter(tile => tile.x === null).map(tile => this.tileElement(tile)));
    if (!tray.children.length) {
      const note = document.createElement('span');
      note.textContent = 'All tiles on board · drop here to return a tile';
      tray.append(note);
    }
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
    $('play-potential').textContent = analysis.score;
    $('play-breakdown').textContent = `${analysis.longest} longest + ${analysis.words.length} words + ${analysis.bonus} all-tiles bonus · ${analysis.used} / 12 tiles on board`;
    $('play-hint').textContent = this.building
      ? 'Tap tray tiles in word order to build your horizontal word. Then choose Arrange tiles, or start dragging.'
      : 'Drag tiles to an empty cell or the tray. You can also select a tile, then tap an empty cell. Tap a blank to set its letter.';
    $('arrange-tiles').hidden = !this.building;
    $('arrange-tiles').disabled = !analysis.used;
    $('play-reset').disabled = !analysis.used && !this.tiles.some(tile => tile.tile === '?' && tile.letter);
    $('play-check').disabled = !analysis.used || this.checking;
    $('play-check').textContent = this.checking ? 'Checking…' : 'Check words';
    $('return-tile').hidden = this.selected === null;
    $('play-words').replaceChildren(...analysis.words.map(word => {
      const chip = document.createElement('span');
      const invalid = this.check?.invalidWords.some(item => item.direction === word.direction && item.ids.join(',') === word.ids.join(','));
      chip.className = `play-word${invalid ? ' invalid' : this.check ? ' checked' : ''}`;
      chip.textContent = `${word.text}${invalid ? ' ×' : this.check ? ' ✓' : ''}`;
      return chip;
    }));
    $('play-status').className = `play-status${this.check ? this.check.valid ? ' valid' : ' invalid' : ''}`;
    $('play-status').textContent = this.message || (this.checking ? 'Checking SOWPODS and the two- and three-letter lists…' : this.check
      ? this.check.valid ? `All words valid · ${this.check.score} points.${analysis.unused ? ` ${analysis.unused} tiles still in the tray.` : ' All 12 tiles used!'} Keep arranging to try for more.` : this.check.issues.join(' ')
      : 'Potential score only. Check words when you’re ready.');
  }
}
