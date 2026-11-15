import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayBoard } from '../play.js';

test('a blank opens from the completed click, never during the opening pointerup', () => {
  const original = globalThis.document;
  const button = { setAttribute() {}, setPointerCapture() {}, dataset: {} };
  globalThis.document = {
    createElement: () => button,
    elementFromPoint: () => ({ closest: () => null }),
  };
  try {
    let opens = 0;
    const board = Object.create(PlayBoard.prototype);
    Object.assign(board, {
      selected: null, check: null,
      tapTile: () => opens++,
      cancelDrag() { this.drag = null; },
    });
    const tile = { id: 0, tile: '?', letter: '', x: null, y: null };
    board.tileElement(tile);
    button.onpointerdown({ isPrimary: true, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    button.onpointerup({ clientX: 100, clientY: 100 });
    assert.equal(opens, 0, 'the picker must not exist while pointerup is being dispatched');
    button.onclick({ detail: 1 });
    assert.equal(opens, 1, 'the finished tap opens the picker once');
    button.onclick({ detail: 0 });
    assert.equal(opens, 2, 'keyboard/accessibility activation still works');
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
