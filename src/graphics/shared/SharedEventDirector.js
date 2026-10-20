import * as THREE from 'three';
import { mulberry32 } from './CosmicEventScheduler.js';
import { LOCAL_RADIUS, neighboursOf } from './layout.js';

const TAU = Math.PI * 2;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bell = u => Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.85;

/**
 * Turns scheduled events into visible, stateful processes. Each event has a
 * begin(), a per-frame tick(u) and an end(); all of them act on the same GPU
 * systems the rest of the scene uses (uniform hooks on the personal-universe
 * galaxy shader, bridge pulses, the comet), so background motion never stops.
 */
export class SharedEventDirector {
  constructor({ galaxies, bridges, comet, getEdges, getFrustum }) {
    this.galaxies = galaxies;
    this.bridges = bridges;
    this.comet = comet;
    this.getEdges = getEdges;
    this.getFrustum = getFrustum;
    this.active = null;
    this.state = null;
    this._v = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
  }

  begin(event, now) {
    this.end(now);
    this.lastNow = now;
    this.active = event;
    const rng = mulberry32(event.seed);
    const g = this.galaxies[event.galaxy];
    const state = this.state = {
      rng, lastNear: -1, sent: false, hops: [], arrivals: new Map(),
      phase: 'anticipation', impactStarted: false
    };
    switch (event.kind) {
      case 'armWave': state.arm = Math.floor(rng() * Math.max(2, g.profile.arms)); break;
      case 'starburst': {
        const picks = [];
        for (let i = 0; i < 3; i++) picks.push(g.anchors[Math.floor(rng() * g.anchors.length)]);
        state.anchors = picks;
        state.times = [0, 0.28 + rng() * 0.08, 0.56 + rng() * 0.08];
        break;
      }
      case 'nebulaBloom': {
        const r = 0.14 + rng() * 0.42, a = rng() * TAU;
        state.cx = Math.cos(a) * r; state.cy = Math.sin(a) * r;
        break;
      }
      case 'aurora': {
        const a = rng() * TAU;
        state.cx = Math.cos(a) * 0.42; state.cy = Math.sin(a) * 0.42;
        state.driftX = Math.cos(a + Math.PI * 0.5) * 0.48;
        state.driftY = Math.sin(a + Math.PI * 0.5) * 0.34;
        break;
      }
      case 'tidalWave': {
        const options = neighboursOf(this.getEdges(), event.galaxy);
        state.tidalLinks = options.slice(0, 2);
        state.wavePhase = rng() * TAU;
        break;
      }
      case 'binaryResonance': {
        const options = neighboursOf(this.getEdges(), event.galaxy);
        state.partner = options[Math.floor(rng() * options.length)]?.other ?? event.galaxy;
        state.partnerBloom = this.galaxies[state.partner];
        break;
      }
      default: break;
    }
  }

  planConvergence(event, rng) {
    const options = neighboursOf(this.getEdges(), event.galaxy);
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    this.state.links = options.slice(0, Math.min(3, options.length)).map(({ edge, other }) => ({
      edge, from: other, to: event.galaxy, sent: false
    }));
    this.state.arrivals.set(event.galaxy, event.start + event.duration * 0.18);
  }

  planCascade(event, rng, now) {
    const edges = this.getEdges();
    const visited = new Set([event.galaxy]);
    let at = event.galaxy;
    const hopCount = 2 + (rng() < 0.55 ? 1 : 0);
    for (let h = 0; h < hopCount; h++) {
      const options = neighboursOf(edges, at).filter(n => !visited.has(n.other));
      if (!options.length) break;
      const pick = options[Math.floor(rng() * options.length)];
      this.state.hops.push({ edge: pick.edge, from: at, to: pick.other, sent: false });
      visited.add(pick.other);
      at = pick.other;
    }
    this.state.hopDuration = event.duration * 0.62 / (this.state.hops.length + 0.45);
    this.galaxies[event.galaxy].pulseCore(1.0);
    this.state.arrivals.set(event.galaxy, now);
  }

  launchComet(event, rng, mode) {
    const galaxies = this.galaxies;
    const a = galaxies[event.galaxy];
    let b = galaxies[(event.galaxy + 1 + Math.floor(rng() * (galaxies.length - 1))) % galaxies.length];
    if (mode === 'stream') b = a;
    const ref = this.getFrustum(0);
    const reach = Math.hypot(ref.halfW, ref.halfH) * 1.08;
    const v = this._v;
    const dir = v[5];
    if (mode === 'stream') {
      const angle = (rng() - 0.5) * 1.5 + (rng() < 0.5 ? 0 : Math.PI);
      dir.set(Math.cos(angle), Math.sin(angle) * 0.7, 0).normalize();
    } else {
      dir.set(b.center.x - a.center.x, b.center.y - a.center.y, 0);
      if (dir.lengthSq() < 1e-3) dir.set(1, 0.2, 0);
      dir.normalize();
    }
    const perp = v[4].set(-dir.y, dir.x, 0);
    const side = rng() < 0.5 ? 1 : -1;
    const near = a.worldRadius * (mode === 'stream' ? 0.12 : 0.42) * side;
    const nearB = b.worldRadius * 0.38 * -side;
    const waypoints = [];
    if (mode === 'stream') {
      waypoints.push(
        v[0].copy(a.center).addScaledVector(dir, -reach).setZ(a.center.z - 5),
        v[1].copy(a.center).addScaledVector(dir, -a.worldRadius * 0.9).addScaledVector(perp, near),
        v[2].copy(a.center).addScaledVector(dir, a.worldRadius * 0.9).addScaledVector(perp, -near * 0.5),
        v[3].copy(a.center).addScaledVector(dir, reach).setZ(a.center.z + 6)
      );
    } else {
      const span = a.center.distanceTo(b.center);
      waypoints.push(
        v[0].copy(a.center).addScaledVector(dir, -reach).setZ(a.center.z - 7),
        v[1].copy(a.center).addScaledVector(perp, near),
        v[2].copy(a.center).lerp(b.center, 0.5).addScaledVector(perp, span * 0.16 * side),
        v[3].copy(b.center).addScaledVector(perp, nearB),
        v[4].copy(b.center).addScaledVector(dir, reach).setZ(b.center.z + 8)
      );
    }
    const color = a.paletteA.clone().lerp(new THREE.Color('#ffffff'), 0.55);
    this.comet.launch(waypoints, { kind: mode, duration: event.duration * 0.84, color });
  }

  tick(now, dt) {
    const event = this.active;
    if (!event) return;
    const state = this.state;
    const g = this.galaxies[event.galaxy];
    const rawU = Math.min(1, Math.max(0, (now - event.start) / event.duration));
    const impactStart = 0.18;
    const impactEnd = 0.78;
    state.phase = event.phase = rawU < impactStart ? 'anticipation' : rawU < impactEnd ? 'impact' : 'afterglow';
    if (state.phase === 'anticipation') {
      const charge = 0.18 + 0.22 * Math.sin(Math.PI * rawU / impactStart);
      g.novaBoost = Math.max(g.novaBoost, charge * 0.32);
      g.setFlare(0, 0, charge);
      this.lastNow = now;
      return;
    }
    if (!state.impactStarted) {
      state.impactStarted = true;
      const rng = state.rng;
      switch (event.kind) {
        case 'comet': this.launchComet(event, rng, 'comet'); break;
        case 'dustStream': this.launchComet(event, rng, 'stream'); break;
        case 'armWave': g.pulseCore(1.15); break;
        case 'cascade': this.planCascade(event, rng, now); break;
        case 'starburst': {
          g.pulseCore(1.15);
          for (const neighbour of neighboursOf(this.getEdges(), event.galaxy)) {
            this.bridges.sendPulse(neighbour.edge, event.galaxy, now, Math.max(1.0, event.duration * 0.27), 1.05, () => {
              const target = this.galaxies[neighbour.other];
              target.pulseCore(0.72);
              target.novaBoost = Math.max(target.novaBoost, 0.72);
            });
          }
          break;
        }
        case 'aurora': {
          g.pulseCore(0.75);
          for (const n of neighboursOf(this.getEdges(), event.galaxy).slice(0, 2)) {
            this.bridges.sendPulse(n.edge, event.galaxy, now, event.duration * 0.32, 0.82);
          }
          break;
        }
        case 'pulsar': {
          g.pulseCore(1.25);
          break;
        }
        case 'supernova': {
          g.pulseCore(2.0);
          for (const n of neighboursOf(this.getEdges(), event.galaxy)) {
            this.bridges.sendPulse(n.edge, event.galaxy, now, event.duration * 0.34, 1.3, () => {
              const target = this.galaxies[n.other];
              target.pulseCore(1.0);
              target.novaBoost = Math.max(target.novaBoost, 0.9);
            });
          }
          break;
        }
        case 'tidalWave': {
          g.pulseCore(1.0);
          for (const link of state.tidalLinks) {
            this.bridges.sendPulse(link.edge, event.galaxy, now, event.duration * 0.38, 1.15);
          }
          break;
        }
        case 'binaryResonance': {
          g.pulseCore(1.1);
          state.partnerBloom.pulseCore(0.8);
          state.partnerBloom.novaBoost = Math.max(state.partnerBloom.novaBoost, 0.6);
          break;
        }
        case 'convergence': this.planConvergence(event, rng); g.pulseCore(0.9); break;
        default: break;
      }
    }
    const u = Math.min(1, Math.max(0, (rawU - impactStart) / (impactEnd - impactStart)));
    switch (event.kind) {
      case 'armWave': {
        const env = bell(u);
        g.novaBoost = Math.max(g.novaBoost, 1.05 * env);
        const p = g.profile;
        const r = 0.7 + 6.3 * Math.pow(u, 0.85);
        const turns = 0.55 + p.pitch * 1.05;
        const a = p.phase + state.arm * TAU / Math.max(2, p.arms) + (r - 0.54) / 7.05 * TAU * turns;
        g.setFlare(Math.cos(a) * r + p.asymmetry * (r / 7.05) * 1.55, Math.sin(a) * r * 0.58, 2.3 * env);
        if (!state.mid && u > 0.36) { state.mid = true; g.pulseCore(0.7); }
        if (!state.sent && u > 0.5) {
          state.sent = true;
          for (const n of neighboursOf(this.getEdges(), event.galaxy)) {
            this.bridges.sendPulse(n.edge, event.galaxy, now, 1.7, 0.95);
          }
        }
        break;
      }
      case 'cascade': {
        const impactElapsed = Math.max(0, now - (event.start + event.duration * impactStart));
        const hop = Math.min(state.hops.length - 1, Math.floor(impactElapsed / state.hopDuration));
        for (let h = 0; h <= hop; h++) {
          const spec = state.hops[h];
          if (!spec || spec.sent) continue;
          spec.sent = true;
          this.bridges.sendPulse(spec.edge, spec.from, now, state.hopDuration * 0.94, 1.0, () => {
            const target = this.galaxies[spec.to];
            target.pulseCore(1.0);
            target.novaBoost = Math.max(target.novaBoost, 1.0);
            state.arrivals.set(spec.to, this.lastNow);
          });
        }
        for (const [index, at] of state.arrivals) {
          const age = this.lastNow - at;
          this.galaxies[index].setFlare(0, 0, 2.0 * Math.exp(-age * 1.9) * smoothstep(0, 0.08, age));
        }
        break;
      }
      case 'convergence': {
        const links = state.links || [];
        links.forEach((link, index) => {
          if (link.sent || u < index * 0.18) return;
          link.sent = true;
          this.bridges.sendPulse(link.edge, link.from, now, event.duration * 0.24, 1.25, () => {
            const target = this.galaxies[link.to];
            target.pulseCore(0.95);
            target.novaBoost = Math.max(target.novaBoost, 0.85);
            state.arrivals.set(link.to, this.lastNow);
          });
        });
        for (const [index, at] of state.arrivals) {
          const age = this.lastNow - at;
          this.galaxies[index].setFlare(0, 0, 1.35 * Math.exp(-age * 1.2));
        }
        break;
      }
      case 'starburst': {
        let slot = 0;
        for (let i = 0; i < state.times.length; i++) if (u >= state.times[i]) slot = i;
        const local = (u - state.times[slot]) * event.duration;
        const attack = smoothstep(0, 0.12, local);
        const strength = 4.4 * attack * Math.exp(-Math.max(0, local - 0.12) * 1.5);
        const anchor = state.anchors[slot];
        g.setFlare(anchor[0], anchor[1], strength);
        g.novaBoost = Math.max(g.novaBoost, 0.45 * attack);
        break;
      }
      case 'nebulaBloom': {
        const amp = smoothstep(0, 0.2, u) * (1 - smoothstep(0.6, 1, u));
        g.setBloom(u, amp, state.cx, state.cy);
        g.setFlare(state.cx * LOCAL_RADIUS * 1.12, state.cy * LOCAL_RADIUS * 1.12, 1.0 * amp);
        break;
      }
      case 'aurora': {
        const sweep = Math.sin(u * Math.PI * 1.5);
        const amp = (0.24 + 0.52 * bell(u)) * (1 - smoothstep(0.82, 1, u));
        const cx = state.cx + state.driftX * sweep;
        const cy = state.cy + state.driftY * sweep;
        g.setBloom(u, amp, cx, cy);
        g.setFlare(cx * LOCAL_RADIUS * 1.12, cy * LOCAL_RADIUS * 1.12, 1.25 * amp);
        break;
      }
      case 'pulsar': {
        const beat = Math.floor(u * 7);
        if (beat !== state.lastBeat) {
          state.lastBeat = beat;
          state.beatAt = u;
          g.pulseCore(beat % 2 ? 0.75 : 1.35);
          const angle = beat * 2.399963229728653 + state.rng() * 0.2;
          state.flashX = Math.cos(angle) * 2.8;
          state.flashY = Math.sin(angle) * 1.8;
          state.flashStrength = beat % 2 ? 1.8 : 2.7;
          const n = neighboursOf(this.getEdges(), event.galaxy)[beat % Math.max(1, neighboursOf(this.getEdges(), event.galaxy).length)];
          if (n) this.bridges.sendPulse(n.edge, event.galaxy, now, 0.9, 0.8);
        }
        g.setFlare(state.flashX || 0, state.flashY || 0, (state.flashStrength || 0) * Math.exp(-Math.max(0, u - state.beatAt) * 25));
        break;
      }
      case 'supernova': {
        const bloom = bell(u);
        g.setBloom(u, 0.9 * bloom, 0, 0);
        g.setFlare(0, 0, 4.8 * bloom);
        g.novaBoost = Math.max(g.novaBoost, 1.8 * bloom);
        break;
      }
      case 'tidalWave': {
        const angle = u * TAU * 1.35 + state.wavePhase;
        const radius = 6.5 - u * 3.8;
        const env = bell(u);
        g.setFlare(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.58, 2.5 * env);
        g.setBloom(u, 0.52 * env, Math.cos(angle) * 0.28, Math.sin(angle) * 0.2);
        g.novaBoost = Math.max(g.novaBoost, 0.75 * env);
        break;
      }
      case 'binaryResonance': {
        const partner = state.partnerBloom;
        const beat = 0.5 + 0.5 * Math.sin(u * TAU * 2);
        const amp = (0.22 + 0.55 * beat) * bell(u);
        const phase = u * Math.PI * 2;
        g.setBloom(u, amp, Math.cos(phase) * 0.24, Math.sin(phase) * 0.2);
        partner.setBloom(u, amp, -Math.cos(phase) * 0.24, -Math.sin(phase) * 0.2);
        g.setFlare(Math.cos(phase) * 2.4, Math.sin(phase) * 1.4, 1.6 * amp);
        partner.setFlare(-Math.cos(phase) * 2.4, -Math.sin(phase) * 1.4, 1.6 * amp);
        if (!state.binarySent && u > 0.48) {
          state.binarySent = true;
          const link = neighboursOf(this.getEdges(), event.galaxy).find(n => n.other === state.partner);
          if (link) this.bridges.sendPulse(link.edge, event.galaxy, now, event.duration * 0.28, 1.15);
        }
        break;
      }
      case 'dustStream': {
        if (this.comet.active) {
          const d = this.comet.head.distanceTo(g.center);
          if (d < g.worldRadius * 1.0 && now - state.lastNear > 0.24) {
            state.lastNear = now;
            g.pulse(this.comet.head, 0.6);
            g.novaBoost = Math.max(g.novaBoost, 0.5);
          }
        }
        break;
      }
      default: break;
    }
    if (state.phase === 'afterglow') {
      const fade = 1 - smoothstep(impactEnd, 1, rawU);
      g.setFlare(0, 0, 0.2 * fade);
      g.novaBoost = Math.max(g.novaBoost, 0.16 * fade);
    }
    this.lastNow = now;
  }

  end() {
    const event = this.active;
    if (!event) return;
    const g = this.galaxies[event.galaxy];
    if (event.kind === 'binaryResonance' && this.state.partnerBloom) {
      this.state.partnerBloom.setBloom(0, 0, 0, 0);
      this.state.partnerBloom.setFlare(0, 0, 0);
    }
    if (event.kind === 'cascade') {
      for (const index of this.state.arrivals.keys()) this.galaxies[index].setFlare(0, 0, 0);
    }
    g.setFlare(0, 0, 0);
    g.setBloom(0, 0, 0, 0);
    if ((event.kind === 'comet' || event.kind === 'dustStream') && this.comet.active) this.comet.stop();
    this.active = null;
    this.state = null;
  }

  dispose() { this.end(); }
}
