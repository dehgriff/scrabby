import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundTimer } from '../round-timer.js';

function clock() {
  let now = 0;
  let tick;
  let expires = 0;
  const ticks = [];
  const timer = new RoundTimer(value => ticks.push(value), () => expires++, {
    now: () => now,
    schedule: callback => { tick = callback; return 1; },
    cancel: () => {},
  });
  return { timer, ticks, advance: value => { now += value; tick?.(); }, get expires() { return expires; } };
}

test('a round starts at 60 and expires exactly once at zero', () => {
  const c = clock();
  c.timer.start();
  assert.deepEqual(c.ticks, [60]);
  c.advance(999);
  assert.deepEqual(c.ticks, [60]);
  c.advance(1);
  assert.deepEqual(c.ticks, [60, 59]);
  c.advance(58_999);
  assert.equal(c.ticks.at(-1), 1);
  assert.equal(c.expires, 0);
  c.advance(1);
  assert.equal(c.ticks.at(-1), 0);
  assert.equal(c.expires, 1);
  c.advance(100_000);
  c.timer.tick();
  assert.equal(c.expires, 1);
  assert.equal(c.timer.running, false);
});

test('delayed ticks catch up to the deadline rather than extending a round', () => {
  const c = clock();
  c.timer.start();
  c.advance(32_200);
  assert.equal(c.ticks.at(-1), 28);
  c.advance(90_000);
  assert.equal(c.ticks.at(-1), 0);
  assert.equal(c.expires, 1);
});

test('stopping for Solve prevents a later automatic check', () => {
  const c = clock();
  c.timer.start();
  c.advance(20_000);
  c.timer.stop();
  c.advance(100_000);
  assert.equal(c.ticks.at(-1), 40);
  assert.equal(c.expires, 0);
});

test('Play restarts at 60 and reset cancels the old countdown', () => {
  const c = clock();
  c.timer.start();
  c.advance(50_000);
  c.timer.start();
  assert.equal(c.ticks.at(-1), 60);
  c.advance(10_000);
  assert.equal(c.ticks.at(-1), 50);
  assert.equal(c.expires, 0);
  c.timer.reset();
  c.advance(100_000);
  assert.equal(c.ticks.at(-1), 60);
  assert.equal(c.expires, 0);
  c.timer.start();
  c.advance(60_000);
  assert.equal(c.expires, 1);
  c.timer.start();
  assert.equal(c.ticks.at(-1), 60);
  assert.equal(c.timer.running, true);
});

test('platform timer functions are not called with a RoundTimer receiver', t => {
  let timer;
  t.mock.method(globalThis, 'setInterval', function () {
    assert.notEqual(this, timer);
    return 123;
  });
  t.mock.method(globalThis, 'clearInterval', function (handle) {
    assert.notEqual(this, timer);
    assert.equal(handle, 123);
  });
  timer = new RoundTimer(() => {}, () => {});
  timer.start();
  timer.stop();
});
