// Use a deadline rather than counting ticks, so background tabs don't gain time.
export class RoundTimer {
  constructor(onTick, onExpire, { now = Date.now, schedule = (callback, delay) => setInterval(callback, delay), cancel = handle => clearInterval(handle) } = {}) {
    Object.assign(this, { onTick, onExpire, now, schedule, cancel });
    this.running = false;
  }

  start() {
    this.stop();
    this.deadline = this.now() + 60_000;
    this.remaining = undefined;
    this.running = true;
    this.handle = this.schedule(() => this.tick(), 200);
    this.tick();
  }

  tick() {
    if (!this.running) return;
    const remaining = Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));
    if (remaining !== this.remaining) {
      this.remaining = remaining;
      this.onTick(remaining);
    }
    if (remaining === 0) {
      this.stop();
      this.onExpire();
    }
  }

  stop() {
    this.running = false;
    if (this.handle !== undefined) this.cancel(this.handle);
    this.handle = undefined;
  }

  reset() {
    this.stop();
    this.remaining = 60;
    this.onTick(60);
  }
}
