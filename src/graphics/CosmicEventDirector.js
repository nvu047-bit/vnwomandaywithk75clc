const EVENT_ORDER = Object.freeze([
  'stellarSupernova',
  'meteorStorm',
  'mathematicalBloom',
  'centrifugalRift',
  'stardustRebirth',
  'galacticHeartbeat',
  'cosmicLens',
  'cosmicConstellation'
]);

export class CosmicEventDirector {
  constructor(onEvent, {
    interval = 10000, initialDelay = interval, events = EVENT_ORDER,
    documentRef = document, timers = window, now = () => performance.now()
  } = {}) {
    this.onEvent = onEvent;
    this.interval = interval;
    this.initialDelay = initialDelay;
    this.events = events;
    this.document = documentRef;
    this.timers = timers;
    this.now = now;
    this.timer = 0;
    this.dueAt = 0;
    this.remaining = initialDelay;
    this.sequence = 0;
    this.running = false;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  start() {
    this.stop();
    this.running = true;
    this.remaining = this.initialDelay;
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.schedule();
  }

  schedule() {
    if (!this.running || this.document.hidden || this.timer) return;
    this.dueAt = this.now() + this.remaining;
    this.timer = this.timers.setTimeout(() => {
      this.timer = 0;
      if (!this.running || this.document.hidden) return;
      const cycle = Math.floor(this.sequence / this.events.length);
      const slot = this.sequence % this.events.length;
      const eventIndex = this.events === EVENT_ORDER && cycle > 0
        ? (slot + cycle * 3) % this.events.length
        : slot;
      const event = this.events[eventIndex];
      this.sequence++;
      this.remaining = this.interval;
      try {
        this.onEvent(event, { sequence: this.sequence - 1, cycle, eventIndex });
      } catch (error) {
        console.error(`Cosmic event "${event}" failed:`, error);
      }
      this.schedule();
    }, this.remaining);
  }

  onVisibilityChange() {
    if (this.document.hidden) {
      if (this.timer) {
        this.remaining = Math.max(0, this.dueAt - this.now());
        this.timers.clearTimeout(this.timer);
        this.timer = 0;
      }
      return;
    }
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) this.timers.clearTimeout(this.timer);
    this.timer = 0;
    this.remaining = this.initialDelay;
    this.sequence = 0;
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

export { EVENT_ORDER as COSMIC_EVENT_ORDER };
