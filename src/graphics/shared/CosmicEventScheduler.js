// Stateful scheduler for shared-galaxy cosmic events. Pure logic: it decides
// *what* happens *when*; SharedEventDirector decides how each event looks.
//
// Guarantees (asserted by tests/shared-galaxy-gl.mjs):
//  - at most one high-salience event is active at any moment;
//  - event starts are three seconds apart, with one active event at a time;
//  - the same kind (or the same galaxy) never fires twice in a row;
//  - ordering comes from a random stream, so there is no fixed repeating cycle.

export const EVENT_KINDS = Object.freeze({
  comet:             { weight: 15, min: 2.5, max: 2.7 },
  armWave:           { weight: 2, min: 2.4, max: 2.7 },
  cascade:           { weight: 2, min: 2.4, max: 2.7 },
  starburst:         { weight: 2, min: 2.2, max: 2.5 },
  dustStream:        { weight: 2, min: 2.4, max: 2.7 },
  nebulaBloom:       { weight: 2, min: 2.4, max: 2.7 },
  convergence:       { weight: 1, min: 2.5, max: 2.8 },
  aurora:            { weight: 2, min: 2.4, max: 2.7 },
  pulsar:            { weight: 2, min: 2.4, max: 2.7 },
  supernova:         { weight: 1, min: 2.2, max: 2.5 },
  tidalWave:         { weight: 2, min: 2.4, max: 2.7 },
  binaryResonance:   { weight: 2, min: 2.5, max: 2.8 }
});

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CosmicEventScheduler {
  constructor({ rng = Math.random, galaxyCount = 9, firstDelay = 1.2, interval = 3 } = {}) {
    this.rng = rng;
    this.galaxyCount = galaxyCount;
    this.interval = interval;
    this.firstDelay = firstDelay;
    this.reset(0);
  }

  reset(now = 0) {
    this.current = null;
    this.nextAt = now + this.firstDelay;
    this.lastKind = null;
    this.lastGalaxy = -1;
    this.counter = 0;
    this.history = [];
  }

  pickKind() {
    const kinds = Object.keys(EVENT_KINDS).filter(kind => kind !== this.lastKind);
    let total = 0;
    for (const kind of kinds) total += EVENT_KINDS[kind].weight;
    let roll = this.rng() * total;
    for (const kind of kinds) {
      roll -= EVENT_KINDS[kind].weight;
      if (roll <= 0) return kind;
    }
    return kinds[kinds.length - 1];
  }

  pickGalaxy() {
    let galaxy = Math.floor(this.rng() * this.galaxyCount);
    if (galaxy === this.lastGalaxy) galaxy = (galaxy + 1 + Math.floor(this.rng() * (this.galaxyCount - 1))) % this.galaxyCount;
    return galaxy;
  }

  /** Advance to `now` (seconds). Returns { finished, started } for this tick. */
  update(now, { enabled = true } = {}) {
    const result = { finished: null, started: null };
    if (this.current && now >= this.current.start + this.current.duration) {
      this.nextAt = this.current.start + this.interval;
      result.finished = this.current;
      this.current = null;
    }
    if (!this.current && enabled && now >= this.nextAt) {
      const kind = this.pickKind();
      const spec = EVENT_KINDS[kind];
      const event = {
        id: ++this.counter,
        kind,
        start: now,
        duration: spec.min + this.rng() * (spec.max - spec.min),
        galaxy: this.pickGalaxy(),
        seed: Math.floor(this.rng() * 0xffffffff)
      };
      this.current = event;
      this.lastKind = kind;
      this.lastGalaxy = event.galaxy;
      this.history.push({ id: event.id, kind, galaxy: event.galaxy, start: now, duration: event.duration });
      if (this.history.length > 64) this.history.shift();
      result.started = event;
    }
    return result;
  }
}
