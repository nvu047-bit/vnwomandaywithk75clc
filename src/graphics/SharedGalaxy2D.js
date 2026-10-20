import { GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES } from '../data/galaxyProfiles.js';
import { recipientArtDirections } from '../data/artDirections.js';
import { SwipeHint } from './shared/SwipeHint.js';
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hexToRgb(hex) {
  const value = String(hex || '#b9acc5').replace('#', '');
  const full = value.length === 3 ? value.split('').map(part => part + part).join('') : value;
  const number = Number.parseInt(full, 16);
  return Number.isFinite(number)
    ? { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }
    : { r: 185, g: 172, b: 197 };
}

function rgba(color, alpha) {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function cubicPoint(points, t, out) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out.x = a * points[0][0] + b * points[1][0] + c * points[2][0] + d * points[3][0];
  out.y = a * points[0][1] + b * points[1][1] + c * points[2][1] + d * points[3][1];
  return out;
}

// The personal-world renderer's curve vocabulary is reused here so each local galaxy
// retains its own mathematical silhouette inside the shared scene.
function profileCurvePoint(curve, t, out) {
  const angle = t * TAU;
  let x = 0, y = 0;
  if (curve === 'lemniscate') {
    const denominator = 1 + Math.sin(angle) ** 2;
    x = 5.5 * Math.cos(angle) / denominator;
    y = 3.6 * Math.sin(angle) * Math.cos(angle) / denominator;
  } else if (curve === 'trochoid') {
    const radius = 4.5 + .72 * Math.cos(3 * angle);
    x = radius * Math.cos(angle); y = radius * .69 * Math.sin(angle);
  } else if (curve === 'rose') {
    const radius = 5.4 * Math.cos(2.5 * angle);
    x = radius * Math.cos(angle); y = radius * .66 * Math.sin(angle);
  } else if (curve === 'superformula') {
    const a = Math.abs(Math.cos(3 * angle / 4)) ** 1.8;
    const b = Math.abs(Math.sin(3 * angle / 4)) ** 1.8;
    const radius = 5.4 / Math.max(.28, (a + b) ** (1 / 1.8));
    x = radius * Math.cos(angle); y = radius * .64 * Math.sin(angle);
  } else if (curve === 'logSpiral') {
    const radius = .85 * Math.exp(.235 * angle);
    x = radius * Math.cos(angle); y = radius * .62 * Math.sin(angle);
  } else if (curve === 'lissajous') {
    x = 5.1 * Math.sin(3 * angle); y = 3.4 * Math.sin(4 * angle + Math.PI / 2);
  } else if (curve === 'phyllotaxis') {
    const radius = .46 + 5.3 * Math.sqrt(t);
    const theta = t * 8 * TAU * .61803398875;
    x = radius * Math.cos(theta); y = radius * .66 * Math.sin(theta);
  } else if (curve === 'epicycle') {
    x = 3.6 * Math.cos(angle) + 1.55 * Math.cos(2.4 * angle);
    y = 2.45 * Math.sin(angle) + 1.55 * Math.sin(2.4 * angle);
  } else {
    const wing = Math.exp(Math.cos(angle)) - 2 * Math.cos(4 * angle) + Math.sin(angle / 12) ** 5;
    x = 1.55 * Math.sin(angle) * wing; y = 1.2 * Math.cos(angle) * wing;
  }
  out.x = Number.isFinite(x) ? x : 0;
  out.y = Number.isFinite(y) ? y : 0;
  return out;
}

const CURVE_MAGNITUDE = Object.freeze({
  lemniscate: 5.8, trochoid: 5.7, rose: 5.8, superformula: 5.8,
  logSpiral: 4.2, lissajous: 5.6, phyllotaxis: 5.9, epicycle: 5.4, butterfly: 4.8
});

// Port of the personal GalaxyArchitecture arm field, adapted to 2D coordinates.
// No per-frame randomness or temporary arrays are created during rendering.
function galaxyArmPoint(profile, arm, progress, seed, direction, time, radius, out) {
  const phase = seed.phase + arm * TAU / Math.max(1, profile.arms || 3);
  const flow = (direction?.flow || 0) + (profile.flow || 0);
  let r, angle;
  if (profile.morphology === 'ribbon') {
    angle = progress * TAU + seed.phase + arm * .18;
    r = 2.8 + arm * .92 + .9 * Math.sin(angle * 1.45 + arm * 1.25);
  } else if (profile.morphology === 'orbital') {
    angle = progress * TAU + phase;
    r = 1.55 + arm * 1.24 + .24 * Math.sin(progress * TAU * 2 + seed.phase);
  } else if (profile.morphology === 'harmonic') {
    angle = progress * TAU * (1.35 + (arm % 2) * .25) + phase;
    r = 1 + (arm % 3) * 1.68 + .3 * Math.sin(progress * TAU + seed.phase);
  } else {
    const turns = .55 + profile.pitch * 1.05;
    angle = phase + progress * TAU * turns;
    r = .54 + progress * 7.05;
    if (profile.morphology === 'bloom') r *= .76 + .24 * Math.abs(Math.cos(profile.arms * angle * .5));
    else if (profile.morphology === 'crystal') { r *= .83 + .17 * Math.cos(profile.arms * angle); angle += Math.sin(angle * 3) * .075; }
    else if (profile.morphology === 'botanical') { angle += Math.sin(progress * TAU * 2 + phase) * .19; r += Math.sin(progress * TAU * 3 + phase) * .2; }
    else if (profile.morphology === 'drift') { r += progress; angle += Math.sin(progress * Math.PI + phase) * .15; }
    else if (profile.morphology === 'deepfield') r += Math.sin(progress * TAU * 3 + phase) * .28;
  }
  // Port the personal-world shader's differential spin into the shared coordinate
  // system: inner material moves faster than the outer arms instead of rotating as
  // one frozen decal. `flow` also bends the stream in a direction-specific way.
  const personalSpin = (profile.spin || .12) * (seed.spin || 1);
  angle += time * (.055 + personalSpin * .82) * (1.24 - progress * .72);
  angle += Math.sin(time * (.22 + Math.abs(flow) * .15) + progress * TAU * 1.7 + phase) * flow * .095;
  r += Math.sin(time * (.38 + Math.abs(flow) * .16) + progress * TAU * 2.35 + phase) * (.075 + Math.abs(flow) * .05);
  const scale = radius / 7.8;
  const yScale = profile.morphology === 'ribbon' ? .62 : profile.morphology === 'orbital' ? .52 : .58;
  let y = Math.sin(angle) * r * yScale;
  if (profile.morphology === 'botanical') y += Math.sin(angle * 1.8 + phase + time * .13) * .34;
  if (profile.morphology === 'drift') y += Math.sin(progress * TAU + phase + time * .16) * progress * .48;
  const wobble = 1 + Math.sin(time * (.31 + (direction?.motion || .5) * .28) + progress * 15 + arm) * .032;
  out.x = (Math.cos(angle) * r + profile.asymmetry * progress * 1.55) * scale * wobble;
  out.y = y * scale * wobble;
  return out;
}

const FLIGHT_PATHS = [
  [[-.08, .39], [.16, .08], [.49, .83], [1.08, .48]],
  [[1.08, .28], [.83, .12], [.41, .88], [-.08, .70]],
  [[-.06, .76], [.22, .90], [.74, .15], [1.08, .35]],
  [[1.07, .68], [.75, .94], [.34, .09], [-.08, .38]],
  [[-.08, .50], [.25, .18], [.68, .92], [1.08, .59]],
  [[1.07, .43], [.79, .10], [.23, .79], [-.08, .61]],
  [[-.07, .28], [.31, .06], [.68, .87], [1.08, .76]],
  [[1.08, .79], [.71, .92], [.48, .12], [-.08, .29]],
  [[-.06, .64], [.28, .95], [.51, .03], [1.08, .44]]
];

const DESKTOP_LAYOUT = [
  [.205, .315], [.385, .225], [.625, .205], [.805, .345],
  [.775, .555], [.635, .735], [.425, .785], [.235, .675], [.145, .475]
];
const MOBILE_LAYOUT = [
  [.5, .5], [1.15, .5], [1.8, .5],
  [.5, 1.15], [1.15, 1.15], [1.8, 1.15],
  [.5, 1.8], [1.15, 1.8], [1.8, 1.8]
];
const FILAMENT_LINKS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0],
  [1, 6], [2, 5], [0, 4], [3, 7], [0, 5]
]);
const NEBULA_CLOUDS = [
  [.29, .38, .29, .18, '#7b5c96', .13, -.34],
  [.68, .51, .31, .21, '#4e7590', .12, .2],
  [.49, .67, .27, .15, '#9b6c88', .105, -.1],
  [.48, .31, .2, .12, '#a58d72', .065, .25],
  [.12, .74, .19, .13, '#5769a1', .075, .45],
  [.86, .21, .22, .12, '#875d8f', .075, -.52],
  [.36, .13, .18, .1, '#587f98', .055, .22],
  [.83, .82, .2, .12, '#967b9f', .06, -.3]
];

export class SharedGalaxy2D {
  constructor({ canvas, view, message, messageMeta, messageText, recipients, wishes, onSelect, onComet }) {
    this.canvas = canvas;
    this.view = view;
    this.message = message;
    this.messageMeta = messageMeta;
    this.messageText = messageText;
    this.recipients = recipients;
    this.wishes = wishes;
    this.onSelect = onSelect;
    this.onComet = onComet;
    this.ctx = canvas?.getContext?.('2d', { alpha: false, desynchronized: true });
    this.active = false;
    this.disposed = false;
    this.raf = 0;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.renderedFrames = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.mobile = matchMedia('(max-width: 680px)').matches || matchMedia('(pointer: coarse)').matches;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motionScale = this.reducedMotion ? .22 : 1;
    this.random = seededRandom(20102026);
    this.stars = [];
    this.dust = [];
    this.nodeReactions = new Float32Array(recipients.length);
    this.nodePoints = recipients.map(() => ({ x: 0, y: 0 }));
    this.galaxySeeds = recipients.map((recipient, index) => ({
      profile: GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[recipient.id]] || GALAXY_PROFILES.twinSpiral,
      direction: recipientArtDirections[recipient.id] || null,
      phase: (index * 2.399963229728653) % TAU,
      depth: .72 + ((index * 7) % 5) * .105,
      spin: .65 + ((index * 3) % 7) * .12
    }));
    this.curveScratch = { x: 0, y: 0 };
    this.spiralScratch = { x: 0, y: 0 };
    this.galaxyScratch = { x: 0, y: 0 };
    this.curvePathScratch = { x: 0, y: 0 };
    this.cosmicEvents = [];
    this.nextEventAt = 7;
    this.comet = null;
    this.cometIndex = -1;
    this.nextCometAt = 0;
    this.manualCooldown = 0;
    this.hoverIndex = -1;
    this.pointer = { x: -1000, y: -1000 };
    this.mobilePan = { x: 0, y: 0 };
    this.gesture = null;
    this.ripples = [];
    this.boundResize = () => this.resize();
    this.boundMove = event => this.onPointerMove(event);
    this.boundLeave = () => { this.pointer.x = -1000; this.pointer.y = -1000; this.hoverIndex = -1; };
    this.boundDown = event => this.onPointerDown(event);
    this.boundUp = event => this.onPointerUp(event);
    this.boundVisibility = () => this.onVisibilityChange();
    this.boundComet = () => this.requestComet();
    this.boundFrame = time => this.frame(time);
    this.resize();
    this.makeStars();
    this.swipeHint = new SwipeHint();
    this.accessibleNodeGroup = document.querySelector('#sharedGalaxyAccessibleNodes');
    this.accessibleBindings = [];
    if (this.accessibleNodeGroup) {
      for (const recipient of recipients) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shared-galaxy-accessible-node';
        button.textContent = recipient.display || recipient.name;
        button.setAttribute('aria-label', `Mở vũ trụ của ${recipient.name}`);
        const activate = () => this.onSelect?.(recipient);
        button.addEventListener('click', activate);
        this.accessibleNodeGroup.append(button);
        this.accessibleBindings.push([button, activate]);
      }
    }
    this.canvas?.addEventListener('pointermove', this.boundMove, { passive: true });
    this.canvas?.addEventListener('pointerleave', this.boundLeave, { passive: true });
    this.canvas?.addEventListener('pointerdown', this.boundDown, { passive: false });
    this.canvas?.addEventListener('pointerup', this.boundUp);
    this.canvas?.addEventListener('pointercancel', this.boundUp);
    window.addEventListener('resize', this.boundResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.cometButton = document.querySelector('#sharedCometButton');
    this.cometButton?.addEventListener('click', this.boundComet);
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.view?.getBoundingClientRect?.() || { width: innerWidth, height: innerHeight };
    this.width = Math.max(1, rect.width || innerWidth);
    this.height = Math.max(1, rect.height || innerHeight);
    this.mobile = this.width < 680 || matchMedia('(pointer: coarse)').matches;
    if (!this.mobile) this.mobilePan.x = this.mobilePan.y = 0;
    else {
      this.mobilePan.x = clamp(this.mobilePan.x, -1.8 * this.width, 0);
      this.mobilePan.y = clamp(this.mobilePan.y, -1.8 * this.height, 0);
    }
    this.dpr = Math.min(this.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.makeStars();
    this.updateNodePositions();
    if (this.active && this.reducedMotion) this.draw(this.elapsed);
  }

  makeStars() {
    // Reuse the personal scene's foreground / midground / deepfield idea without
    // spinning up nine renderers: a fixed particle budget is shared by the whole sky.
    const random = this.random || seededRandom(20102026);
    const count = this.mobile ? 96 : 250;
    this.stars = Array.from({ length: count }, (_, index) => {
      const depth = .18 + random() * .82;
      return {
        x: random(), y: random(), size: (.25 + random() * (this.mobile ? .95 : 1.5)) * depth,
        alpha: (.1 + random() * .48) * (.48 + depth * .52), phase: random() * TAU,
        speed: .1 + random() * .55, drift: (random() - .5) * (.002 + depth * .004),
        depth, warm: random() > .84, foreground: depth > .78 && index % 7 === 0
      };
    });
    const dustCount = this.mobile ? 112 : 300;
    this.dust = Array.from({ length: dustCount }, () => ({
      x: random(), y: random(), vx: (random() - .5) * .012, vy: (random() - .5) * .01,
      size: .45 + random() * (this.mobile ? 1.0 : 1.65), phase: random() * TAU,
      alpha: .1 + random() * .28, depth: .25 + random() * .75,
      tone: random() > .66 ? 1 : random() > .5 ? 2 : 0
    }));
  }

  get layout() { return this.mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT; }

  updateNodePositions() {
    const layout = this.layout;
    const time = this.elapsed;
    const driftScale = Math.min(this.width, this.height) * 0.008;
    for (let i = 0; i < this.nodePoints.length; i++) {
      const point = layout[i] || [.5, .5];
      const phase = this.galaxySeeds[i]?.phase || 0;
      const driftX = Math.sin(time * 0.17 + phase) - Math.sin(phase);
      const driftY = Math.sin(time * 0.13 + phase * 1.7) - Math.sin(phase * 1.7);
      this.nodePoints[i].x = point[0] * this.width + driftX * driftScale + (this.mobile ? this.mobilePan.x : 0);
      this.nodePoints[i].y = point[1] * this.height + driftY * driftScale * 0.75 + (this.mobile ? this.mobilePan.y : 0);
    }
  }

  nodePoint(index) { return this.nodePoints[index] || this.curveScratch; }

  start({ focusIndex = 0 } = {}) {
    if (this.disposed || this.active) return;
    this.active = true;
    this.lastFrame = 0;
    if (this.mobile && Number.isInteger(focusIndex) && focusIndex >= 0 && focusIndex < MOBILE_LAYOUT.length) {
      const [x, y] = MOBILE_LAYOUT[focusIndex];
      this.mobilePan.x = clamp(this.width * (0.5 - x), -1.8 * this.width, 0);
      this.mobilePan.y = clamp(this.height * (0.5 - y), -1.8 * this.height, 0);
    } else this.mobilePan.x = this.mobilePan.y = 0;
    this.updateNodePositions();
    this.swipeHint.show(this.mobile);
    this.nextCometAt = performance.now() + (this.reducedMotion ? 1e12 : 1300);
    this.nextEventAt = this.elapsed + 3;
    this.cosmicEvents.length = 0;
    this.view?.classList.add('is-active');
    this.view?.setAttribute('aria-hidden', 'false');
    if (this.cometButton) {
      this.cometButton.disabled = this.reducedMotion;
      this.cometButton.setAttribute('aria-label', this.reducedMotion
        ? 'Đang bật chế độ chuyển động nhẹ; hãy chọn một vũ trụ để ghé thăm'
        : 'Gọi một sao chổi mang lời chúc chung');
    }
    // Reduced motion still receives a slow, low-amplitude living background;
    // high-salience comets and cosmic events remain disabled in that mode.
    this.frame(performance.now());
  }

  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastFrame = 0;
    this.gesture = null;
    this.swipeHint.hide();
    this.comet = null;
    this.ripples.length = 0;
    this.message?.classList.remove('is-visible');
    this.message?.setAttribute('aria-hidden', 'true');
    this.view?.classList.remove('is-active');
    this.view?.setAttribute('aria-hidden', 'true');
    if (this.cometButton) this.cometButton.disabled = false;
  }

  onVisibilityChange() {
    if (!this.active) return;
    if (document.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastFrame = 0;
    } else if (!this.raf) {
      this.lastFrame = 0;
      this.frame(performance.now());
    }
  }

  frame(now) {
    if (!this.active || this.disposed || document.hidden) {
      this.raf = 0;
      return;
    }
    const realDt = this.lastFrame ? clamp((now - this.lastFrame) / 1000, 0, .04) : 0;
    const dt = realDt * this.motionScale;
    this.lastFrame = now;
    this.elapsed += dt;
    this.update(dt, now);
    this.draw(this.elapsed);
    this.renderedFrames++;
    this.raf = requestAnimationFrame(this.boundFrame);
  }

  update(dt, now) {
    this.updateNodePositions();
    for (let i = 0; i < this.nodeReactions.length; i++) {
      this.nodeReactions[i] = Math.max(0, this.nodeReactions[i] - dt * 1.05);
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt;
      if (this.ripples[i].age > .95) this.ripples.splice(i, 1);
    }
    for (let i = this.cosmicEvents.length - 1; i >= 0; i--) {
      this.cosmicEvents[i].age += dt;
      if (this.cosmicEvents[i].age > this.cosmicEvents[i].duration) this.cosmicEvents.splice(i, 1);
    }
    if (!this.reducedMotion && !this.comet && !this.cosmicEvents.length && this.elapsed >= this.nextEventAt) {
      const index = Math.floor(this.random() * this.recipients.length);
      const event = { index, age: 0, duration: 2.7, type: Math.floor(this.random() * 8), phase: this.random() * TAU, reached: new Set([index]), reachedAt: new Map([[index, 0]]) };
      this.cosmicEvents.push(event);
      this.nodeReactions[index] = Math.max(this.nodeReactions[index], .92);
      const origin = this.nodePoint(index);
      this.ripples.push({ x: origin.x, y: origin.y, age: 0 });
      if (this.ripples.length > 5) this.ripples.shift();
      this.nextEventAt = this.elapsed + 3;
    }

    // Keep high-salience phenomena sequential rather than stacking several bright events.
    if (!this.comet && !this.cosmicEvents.length && !this.reducedMotion && now >= this.nextCometAt) this.spawnComet(false, now);
    for (const event of this.cosmicEvents) {
      for (let linkIndex = 0; linkIndex < FILAMENT_LINKS.length; linkIndex++) {
        const link = FILAMENT_LINKS[linkIndex];
        // Each arrival becomes a new source, so the pulse can cascade through
        // several connected galaxies rather than stopping at the origin's neighbors.
        let sourceIndex = -1;
        if (event.reachedAt.has(link[0]) && !event.reachedAt.has(link[1])) sourceIndex = link[0];
        else if (event.reachedAt.has(link[1]) && !event.reachedAt.has(link[0])) sourceIndex = link[1];
        if (sourceIndex < 0) continue;
        const neighborIndex = sourceIndex === link[0] ? link[1] : link[0];
        const sourceAge = event.reachedAt.get(sourceIndex) || 0;
        const a = this.nodePoint(link[0]), b = this.nodePoint(link[1]);
        const distance = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, Math.min(this.width, this.height));
        const travel = 1.05 + Math.min(1.25, distance) * .48;
        if (event.age >= sourceAge + travel + .18) {
          event.reached.add(neighborIndex);
          event.reachedAt.set(neighborIndex, event.age);
          this.nodeReactions[neighborIndex] = Math.max(this.nodeReactions[neighborIndex], .78);
          const target = this.nodePoint(neighborIndex);
          this.ripples.push({ x: target.x, y: target.y, age: 0 });
          if (this.ripples.length > 5) this.ripples.shift();
        }
      }
    }
    if (!this.comet) return;

    const comet = this.comet;
    comet.elapsed += dt;
    const progress = clamp(comet.elapsed / comet.duration, 0, 1);
    const eased = Math.pow(progress, 1.22);
    comet.previousX = comet.x;
    comet.previousY = comet.y;
    cubicPoint(comet.path, eased, this.curveScratch);
    comet.x = this.curveScratch.x * this.width;
    comet.y = this.curveScratch.y * this.height;
    if (comet.elapsed < comet.duration) {
      const particle = comet.trail[comet.trailCursor];
      particle.x = comet.x;
      particle.y = comet.y;
      particle.age = 0;
      comet.trailCursor = (comet.trailCursor + 1) % comet.trail.length;

      for (let i = 0; i < this.recipients.length; i++) {
        const node = this.nodePoint(i);
        const dx = node.x - comet.x;
        const dy = node.y - comet.y;
        if (dx * dx + dy * dy < (this.mobile ? 62 : 88) ** 2 && !comet.hitNodes.has(i)) {
          comet.hitNodes.add(i);
          this.nodeReactions[i] = 1;
          this.ripples.push({ x: node.x, y: node.y, age: 0 });
          if (this.ripples.length > 5) this.ripples.shift();
        }
      }
    }
    for (const trailParticle of comet.trail) trailParticle.age += dt;

    // The shared sky is intentionally typography-free apart from the nine names.
    // Wishes remain bound to each comet internally; the visual message card is not rendered.
    if (comet.elapsed >= comet.duration + .45) {
      this.comet = null;
      this.message?.classList.remove('is-visible');
      this.message?.setAttribute('aria-hidden', 'true');
      if (this.cometButton) this.cometButton.disabled = false;
    }
  }

  spawnComet(manual = false, now = performance.now()) {
    if (!this.active || this.comet || this.cosmicEvents.length || this.reducedMotion) return false;
    const step = this.wishes.length || 1;
    let next = this.cometIndex + 1;
    if (step > 1 && next >= step) next = 0;
    this.cometIndex = next;
    const path = FLIGHT_PATHS[next % FLIGHT_PATHS.length].map(point => [...point]);
    if ((next + Math.floor(now / 5000)) % 2 === 1) path.reverse();
    this.comet = {
      index: next,
      message: this.wishes[next % this.wishes.length],
      path,
      elapsed: 0,
      duration: manual ? 4.0 : 2.5,
      x: path[0][0] * this.width,
      y: path[0][1] * this.height,
      previousX: path[0][0] * this.width,
      previousY: path[0][1] * this.height,
      trail: Array.from({ length: this.mobile ? 18 : 34 }, () => ({ x: 0, y: 0, age: 999 })),
      trailCursor: 0,
      hitNodes: new Set(),
      seed: this.random() * TAU
    };
    this.nextCometAt = now + (manual ? 6000 : 3000);
    if (this.cometButton) this.cometButton.disabled = true;
    this.onComet?.(this.comet.message);
    return true;
  }

  requestComet() {
    if (!this.active || this.comet || this.cosmicEvents.length || this.reducedMotion) return;
    const now = performance.now();
    if (now < this.manualCooldown) return;
    this.manualCooldown = now + 6000;
    if (this.spawnComet(true, now)) this.nextCometAt = now + 6000;
  }

  onPointerMove(event) {
    if (!this.active) return;
    if (this.gesture?.pointerId === event.pointerId) {
      const dx = event.clientX - this.gesture.lastX;
      const dy = event.clientY - this.gesture.lastY;
      this.gesture.lastX = event.clientX;
      this.gesture.lastY = event.clientY;
      if (Math.hypot(event.clientX - this.gesture.startX, event.clientY - this.gesture.startY) > 8) this.gesture.moved = true;
      if (this.gesture.moved) {
        this.mobilePan.x = clamp(this.mobilePan.x + dx, -1.8 * this.width, 0);
        this.mobilePan.y = clamp(this.mobilePan.y + dy, -1.8 * this.height, 0);
        this.updateNodePositions();
        event.preventDefault?.();
      }
      return;
    }
    if (event.pointerType === 'touch') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    const hit = this.hitNode(this.pointer.x, this.pointer.y);
    this.hoverIndex = hit;
    this.canvas.style.cursor = hit >= 0 ? 'pointer' : 'crosshair';
  }

  onPointerDown(event) {
    if (!this.active || event.button > 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (this.mobile) {
      this.gesture = {
        pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        lastX: event.clientX, lastY: event.clientY, moved: false
      };
      this.canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    this.activateAt(event, x, y);
  }

  onPointerUp(event) {
    if (!this.gesture || this.gesture.pointerId !== event.pointerId) return;
    const gesture = this.gesture;
    this.gesture = null;
    this.canvas.releasePointerCapture?.(event.pointerId);
    if (!gesture.moved) {
      const rect = this.canvas.getBoundingClientRect();
      this.activateAt(event, event.clientX - rect.left, event.clientY - rect.top);
    }
  }

  activateAt(event, x, y) {
    const index = this.hitNode(x, y);
    if (index >= 0) {
      event.preventDefault?.();
      this.nodeReactions[index] = 1;
      this.onSelect?.(this.recipients[index]);
      return;
    }
    this.ripples.push({ x, y, age: 0 });
    if (this.ripples.length > 3) this.ripples.shift();
  }

  hitNode(x, y) {
    const radius = this.mobile ? 33 : 42;
    let closest = -1;
    let closestDistance = radius * radius;
    for (let i = 0; i < this.recipients.length; i++) {
      const point = this.nodePoint(i);
      const dx = point.x - x;
      const dy = point.y - y;
      const distance = dx * dx + dy * dy;
      if (distance <= closestDistance) { closestDistance = distance; closest = i; }
    }
    return closest;
  }

  draw(time) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    ctx.globalCompositeOperation = 'source-over';
    const backdrop = ctx.createLinearGradient(0, 0, w * .78, h);
    backdrop.addColorStop(0, '#090a16');
    backdrop.addColorStop(.52, '#131426');
    backdrop.addColorStop(1, '#080914');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);

    this.drawNebulae(time);
    this.drawStars(time);
    this.drawIntergalacticFilaments(time);
    this.drawDust(time);
    this.drawAmbientComets(time);
    this.drawLivingGalaxies(time);
    this.drawCosmicEvents(time);
    this.drawNodes(time);
    this.drawRipples();
    this.drawComet(time);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawNebulae(time) {
    const ctx = this.ctx;
    const clouds = NEBULA_CLOUDS;
    for (let i = 0; i < clouds.length; i++) {
      const [nx, ny, rx, ry, color, alpha, rot] = clouds[i];
      const pulse = .90 + .10 * Math.sin(time * (.19 + (i % 3) * .025) + i * 1.9);
      const driftX = Math.sin(time * (.026 + (i % 3) * .006) + i * 1.71) * this.width * .012;
      const driftY = Math.cos(time * (.021 + (i % 4) * .004) + i * 1.13) * this.height * .014;
      ctx.save();
      ctx.translate(nx * this.width + driftX, ny * this.height + driftY);
      ctx.rotate(rot + Math.sin(time * .075 + i) * .075);
      ctx.scale(1, (ry * this.height) / Math.max(1, rx * this.width));
      const radius = rx * this.width * pulse;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(.42, rgba(color, alpha * .48));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  spiralPoint(arm, t, time = 0, out = this.spiralScratch) {
    const phase = arm * TAU / 3 + .45 + time * .018 * (arm % 2 ? -1 : 1);
    const angle = t * TAU * 1.12 + phase;
    const radius = .025 + t * .43;
    const asymmetry = (arm - 1) * t * .025;
    out.x = (.5 + Math.cos(angle) * radius + asymmetry) * this.width;
    out.y = (.51 + Math.sin(angle) * radius * .57) * this.height;
    return out;
  }

  drawIntergalacticFilaments(time) {
    const ctx = this.ctx;
    if (this.nodePoints.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Curved, low-contrast bridges imply shared gravity without turning the scene into a diagram.
    // The immutable link topology lives outside the frame loop to avoid per-frame allocations.
    for (let i = 0; i < FILAMENT_LINKS.length; i++) {
      const a = this.nodePoint(FILAMENT_LINKS[i][0]);
      const b = this.nodePoint(FILAMENT_LINKS[i][1]);
      const dx = b.x - a.x, dy = b.y - a.y;
      const bend = ((i % 2) ? 1 : -1) * Math.min(this.width, this.height) * (.055 + (i % 3) * .018);
      const cx = (a.x + b.x) * .5 - dy * .12 + Math.sin(time * .11 + i) * 4;
      const cy = (a.y + b.y) * .5 + dx * .12 + bend;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.strokeStyle = `rgba(${i % 3 === 0 ? '176,151,218' : i % 3 === 1 ? '112,178,203' : '220,171,174'},${.09 + .025 * (1 + Math.sin(time * .3 + i))})`;
      ctx.lineWidth = this.mobile ? 5 : 8;
      ctx.shadowColor = '#9bb8ed'; ctx.shadowBlur = this.mobile ? 8 : 15; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.strokeStyle = `rgba(207,211,255,${.16 + .045 * (1 + Math.sin(time * .22 + i * 1.7))})`;
      ctx.lineWidth = this.mobile ? 1 : 1.25; ctx.stroke();
      // A small traveling pulse makes the bridge feel like moving material, not a static connector.
      const t = (time * (.066 + (i % 4) * .018) + i * .173) % 1;
      const u = 1 - t;
      const px = u*u*a.x + 2*u*t*cx + t*t*b.x;
      const py = u*u*a.y + 2*u*t*cy + t*t*b.y;
      const tailT = Math.max(0, t - .055);
      const tailU = 1 - tailT;
      const tailX = tailU*tailU*a.x + 2*tailU*tailT*cx + tailT*tailT*b.x;
      const tailY = tailU*tailU*a.y + 2*tailU*tailT*cy + tailT*tailT*b.y;
      ctx.strokeStyle = 'rgba(220,226,255,.20)';
      ctx.lineWidth = this.mobile ? .65 : .9;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = 'rgba(240,235,255,.72)';
      ctx.shadowColor = '#c4d8ff'; ctx.shadowBlur = this.mobile ? 4 : 8;
      ctx.beginPath(); ctx.arc(px, py, this.mobile ? 1.8 : 2.4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      // A second out-of-phase packet makes the bridge read as a stream of material.
      const t2 = (t + .49) % 1;
      const u2 = 1 - t2;
      const px2 = u2*u2*a.x + 2*u2*t2*cx + t2*t2*b.x;
      const py2 = u2*u2*a.y + 2*u2*t2*cy + t2*t2*b.y;
      ctx.globalAlpha = .48;
      ctx.fillStyle = 'rgba(168,202,235,.82)';
      ctx.beginPath(); ctx.arc(px2, py2, this.mobile ? 1.2 : 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;

      // Cosmic events send a pulse outward through the same curved filament network.
      for (const event of this.cosmicEvents) {
        const from = FILAMENT_LINKS[i][0], to = FILAMENT_LINKS[i][1];
        const fromAge = event.reachedAt.get(from);
        const toAge = event.reachedAt.get(to);
        if (fromAge === undefined && toAge === undefined) continue;
        // Draw the pulse in arrival order. When both endpoints have reacted,
        // the earlier arrival keeps the wave direction coherent across the link.
        const endpointIndex = fromAge === undefined ? 1 : (toAge === undefined || fromAge <= toAge ? 0 : 1);
        const sourceAge = endpointIndex === 0 ? fromAge : toAge;
        const distance = Math.hypot(dx, dy) / Math.max(1, Math.min(this.width, this.height));
        const travel = 1.05 + Math.min(1.25, distance) * .48;
        const waveAge = event.age - sourceAge;
        const q = clamp((waveAge - .18) / travel, 0, 1);
        const eventT = endpointIndex === 0 ? q : 1 - q;
        const eventU = 1 - eventT;
        const ex = eventU*eventU*a.x + 2*eventU*eventT*cx + eventT*eventT*b.x;
        const ey = eventU*eventU*a.y + 2*eventU*eventT*cy + eventT*eventT*b.y;
        const eventAlpha = (1 - clamp((waveAge - .18 - travel) / .48, 0, 1)) * .9;
        if (eventAlpha > .01) {
          ctx.globalAlpha = eventAlpha;
          ctx.fillStyle = '#fff2e0';
          ctx.shadowColor = '#dacbff'; ctx.shadowBlur = this.mobile ? 6 : 12;
          ctx.beginPath(); ctx.arc(ex, ey, this.mobile ? 2.1 : 3.2, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  drawLivingGalaxies(time) {
    const ctx = this.ctx;
    const minDim = Math.min(this.width, this.height);
    const samples = this.mobile ? 34 : 52;
    const curveSamples = this.mobile ? 54 : 86;
    for (let index = 0; index < this.recipients.length; index++) {
      const recipient = this.recipients[index];
      const point = this.nodePoint(index);
      const seed = this.galaxySeeds[index];
      const profile = seed.profile;
      const direction = seed.direction;
      const color = recipient.palette?.[0] || '#b9acc5';
      const secondary = recipient.palette?.[1] || '#8290ad';
      const tertiary = recipient.palette?.[2] || '#d3b8d2';
      const motion = direction?.motion ?? .5;
      const pulse = 1 + Math.sin(time * (.25 + profile.pulse * .18) + seed.phase) * (.025 + motion * .012);
      const radius = minDim * (this.mobile ? .077 : .094) * seed.depth * pulse;
      // Keep a slow orbital drift, but let inner streams and particles animate
      // independently so no world reads as a single rotating sticker.
      const rotation = time * profile.spin * seed.spin * (.72 + motion * .48) + seed.phase;
      const reaction = this.nodeReactions[index] || 0;

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(rotation);
      ctx.globalCompositeOperation = 'screen';

      // Volumetric glow borrowed from the raymarched NebulaFlow look in personal worlds.
      const halo = ctx.createRadialGradient(0, 0, radius * .08, 0, 0, radius * 2.75);
      halo.addColorStop(0, rgba('#fff5ed', .055 + reaction * .06));
      halo.addColorStop(.19, rgba(color, (.19 + reaction * .13) * profile.halo));
      halo.addColorStop(.48, rgba(secondary, .09 * profile.clouds));
      halo.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, radius * 2.75, 0, TAU); ctx.fill();

      // Irregular nebula lobes have independent breathing phases rather than one global scale pulse.
      for (let lobe = 0; lobe < 3; lobe++) {
        const phase = seed.phase + lobe * 2.17;
        const wobble = 1 + .16 * Math.sin(time * (.28 + motion * .18) + phase);
        const lx = Math.cos(phase + time * (.045 + Math.abs(profile.flow) * .018)) * radius * (.38 + lobe * .2);
        const ly = Math.sin(phase * 1.3 + time * (.052 + motion * .018)) * radius * (.25 + lobe * .14);
        const lr = radius * (.9 + lobe * .24) * wobble * profile.clouds * .72;
        const cloud = ctx.createRadialGradient(lx, ly, lr * .03, lx, ly, lr);
        cloud.addColorStop(0, rgba(lobe === 1 ? tertiary : color, .09 + reaction * .05));
        cloud.addColorStop(.42, rgba(lobe === 1 ? secondary : color, .04));
        cloud.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = cloud; ctx.beginPath(); ctx.ellipse(lx, ly, lr, lr * (.44 + profile.thickness * .13), phase, 0, TAU); ctx.fill();
      }

      // Dust lanes / accretion ribbons: two animated, offset elliptical bands like the personal scene.
      ctx.save();
      ctx.rotate(.24 * Math.sin(seed.phase) + Math.sin(time * .09 + seed.phase) * .035);
      for (let ring = 0; ring < 3; ring++) {
        const ringPulse = 1 + .022 * Math.sin(time * (.18 + ring * .07) + seed.phase + ring);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (1.18 + ring * .34) * ringPulse, radius * (.26 + ring * .095) * profile.thickness, ring * .12, 0, TAU);
        ctx.strokeStyle = rgba(ring === 1 ? secondary : color, (.14 - ring * .032) * profile.clouds);
        ctx.lineWidth = ring === 0 ? (this.mobile ? 5 : 8) : (this.mobile ? .7 : 1.05);
        ctx.shadowColor = ring === 0 ? color : secondary;
        ctx.shadowBlur = ring === 0 ? (this.mobile ? 7 : 13) : 2;
        ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;

      const arms = Math.max(2, Math.min(this.mobile ? 4 : 6, profile.arms || 3));
      for (let arm = 0; arm < arms; arm++) {
        ctx.beginPath();
        for (let j = 0; j <= samples; j++) {
          const p = galaxyArmPoint(profile, arm, j / samples, seed, direction, time, radius, this.galaxyScratch);
          if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        const armColor = arm % 3 === 0 ? color : arm % 3 === 1 ? secondary : tertiary;
        const shimmer = .77 + .23 * Math.sin(time * (.45 + motion * .3) + arm * 1.8 + seed.phase);
        ctx.strokeStyle = rgba(armColor, (.08 + .035 * profile.clouds) * shimmer);
        ctx.lineWidth = this.mobile ? 5.5 : 9;
        ctx.shadowColor = armColor; ctx.shadowBlur = this.mobile ? 7 : 13; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(armColor, (.32 + .12 * motion) * shimmer);
        ctx.lineWidth = this.mobile ? .65 : 1.05; ctx.stroke();
        // Short high-frequency streaks create the moving filament detail of NebulaFlow.
        ctx.beginPath();
        const flowStart = (time * (.018 + Math.abs(profile.flow) * .006) + arm / arms + seed.phase / TAU) % 1;
        for (let j = 0; j <= 10; j++) {
          const progress = (flowStart + j * .0065) % 1;
          const p = galaxyArmPoint(profile, arm, progress, seed, direction, time, radius, this.galaxyScratch);
          if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = rgba('#fff1e4', .26 + .08 * Math.sin(time * 1.8 + seed.phase));
        ctx.lineWidth = this.mobile ? .8 : 1.3; ctx.stroke();
      }

      // Personal mathematical signature, using the same rose/lemniscate/epicycle family as the individual scene.
      const curve = profile.curve;
      const curveScale = radius * (profile.curveScale || 1) / (CURVE_MAGNITUDE[curve] || 5.5) * .88;
      ctx.beginPath();
      for (let j = 0; j <= curveSamples; j++) {
        const t = j / curveSamples;
        const p = profileCurvePoint(curve, t, this.curvePathScratch);
        const breathe = 1 + .014 * Math.sin(time * (.24 + motion * .2) + t * TAU * 2 + seed.phase);
        const x = p.x * curveScale * breathe;
        const y = p.y * curveScale * breathe * (direction?.aspect?.[1] ? direction.aspect[0] / direction.aspect[1] : 1);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(tertiary, .12 + reaction * .12);
      ctx.lineWidth = this.mobile ? 3.4 : 5.5;
      ctx.shadowColor = tertiary; ctx.shadowBlur = this.mobile ? 8 : 14; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba('#fff5ea', .29 + reaction * .2);
      ctx.lineWidth = this.mobile ? .62 : .88; ctx.stroke();

      // Bright matter packets actually travel along their own arm coordinates.
      // Their phase and speed differ per galaxy and per stream; these are not fixed stars.
      const streams = this.mobile ? 4 : 7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let stream = 0; stream < streams; stream++) {
        const streamArm = (stream + index) % arms;
        const speed = .075 + Math.abs(profile.flow) * .045 + (stream % 3) * .012;
        const progress = (time * speed + stream / streams + seed.phase / TAU) % 1;
        const tailProgress = Math.max(0, progress - (.034 + (stream % 2) * .014));
        const head = galaxyArmPoint(profile, streamArm, progress, seed, direction, time, radius, this.galaxyScratch);
        const tail = galaxyArmPoint(profile, streamArm, tailProgress, seed, direction, time, radius, this.curveScratch);
        const streamColor = stream % 3 === 0 ? '#fff1dc' : (stream % 2 ? tertiary : secondary);
        ctx.globalAlpha = .30 + .16 * Math.sin(time * 2.1 + stream + seed.phase);
        ctx.strokeStyle = streamColor;
        ctx.lineWidth = this.mobile ? .7 : 1.05;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
        ctx.globalAlpha = .62 + .28 * (.5 + .5 * Math.sin(time * 3.2 + stream * 2.1 + seed.phase));
        ctx.fillStyle = streamColor;
        ctx.shadowColor = streamColor;
        ctx.shadowBlur = this.mobile ? 3 : 6;
        ctx.beginPath(); ctx.arc(head.x, head.y, this.mobile ? 1.05 : 1.55, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Repeating spiral wave travels outward, echoing centrifugal-wave events from personal worlds.
      const wave = (time * (.09 + Math.abs(profile.flow) * .025) + seed.phase / TAU) % 1;
      const waveRadius = radius * (.18 + wave * 1.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, waveRadius * (1 + profile.asymmetry * .14), waveRadius * (.42 + profile.thickness * .05), seed.phase * .12, 0, TAU);
      ctx.strokeStyle = rgba(color, (1 - wave) * (.12 + reaction * .1));
      ctx.lineWidth = this.mobile ? .55 : .85; ctx.stroke();

      // Arm-following stars are deterministic and rotate with their own field.
      const clusters = this.mobile ? 23 : 42;
      for (let k = 0; k < clusters; k++) {
        const arm = k % arms;
        const t = (k * .61803398875 + index * .137) % 1;
        const p = galaxyArmPoint(profile, arm, t, seed, direction, time + (k % 4) * .16, radius, this.galaxyScratch);
        const twinkle = .36 + .64 * (.5 + .5 * Math.sin(time * (1.05 + (k % 5) * .23) + k * 2.4 + seed.phase));
        const starRadius = (this.mobile ? .55 : .75) + (k % 7 === 0 ? (this.mobile ? .95 : 1.45) : 0);
        ctx.globalAlpha = twinkle * (.34 + profile.clusters * .1);
        ctx.fillStyle = k % 5 === 0 ? '#fff0db' : k % 2 ? color : secondary;
        ctx.beginPath(); ctx.arc(p.x, p.y, starRadius, 0, TAU); ctx.fill();
        if (k % 7 === 0) {
          ctx.strokeStyle = rgba(tertiary, .22 * twinkle); ctx.lineWidth = .45;
          ctx.beginPath(); ctx.moveTo(p.x - starRadius * 2.2, p.y); ctx.lineTo(p.x + starRadius * 2.2, p.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Luminous nucleus and a tiny lens flare pulse; energy is individual, never synchronized.
      const coreRadius = radius * (.12 + profile.core * .075) * (1 + Math.sin(time * (.9 + profile.pulse * .25) + seed.phase) * .07);
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 4.2);
      core.addColorStop(0, `rgba(255,250,241,${.9 + reaction * .08})`);
      core.addColorStop(.15, rgba(color, .67 + reaction * .13));
      core.addColorStop(.42, rgba(secondary, .21));
      core.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, coreRadius * 4.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#fff7e9', .25 + reaction * .25);
      ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(-coreRadius * (2 + Math.sin(time + seed.phase) * .25), 0); ctx.lineTo(coreRadius * (2 + Math.sin(time + seed.phase) * .25), 0); ctx.stroke();
      ctx.restore();
    }
  }

  drawCosmicEvents(time) {
    if (!this.cosmicEvents.length) return;
    const ctx = this.ctx;
    const minDim = Math.min(this.width, this.height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const event of this.cosmicEvents) {
      const point = this.nodePoint(event.index);
      const recipient = this.recipients[event.index];
      const color = recipient?.palette?.[0] || '#b9acc5';
      const progress = clamp(event.age / event.duration, 0, 1);
      const fade = Math.sin(Math.PI * progress);
      const radius = minDim * (.014 + progress * .22);
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(event.phase + time * .08);
      if (event.type === 0) {
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * (1 + ring * .14), radius * (.58 + ring * .11), ring * .22, 0, TAU);
          ctx.strokeStyle = rgba(ring === 1 ? '#d5c7ff' : color, fade * (.24 - ring * .055));
          ctx.lineWidth = ring === 0 ? 1.1 : .6; ctx.stroke();
        }
      } else if (event.type === 1) {
        const rays = this.mobile ? 9 : 15;
        for (let ray = 0; ray < rays; ray++) {
          const angle = ray / rays * TAU;
          const inner = radius * (.2 + .08 * Math.sin(ray + event.phase));
          const outer = radius * (.72 + .28 * Math.sin(ray * 2.7 + event.phase));
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.strokeStyle = rgba(ray % 3 ? color : '#fff0df', fade * .44);
          ctx.lineWidth = ray % 4 === 0 ? 1 : .55; ctx.stroke();
        }
      } else if (event.type === 2) {
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * (.72 + ring * .25), radius * (.3 + ring * .11), -event.phase * .3 + ring * .35, .3 + progress, 2.6 + progress * 2.8);
          ctx.strokeStyle = rgba(ring === 1 ? '#fff0df' : color, fade * (.33 - ring * .08));
          ctx.lineWidth = ring === 0 ? 1 : .65; ctx.stroke();
        }
      } else if (event.type === 3) {
        for (let ribbon = 0; ribbon < 3; ribbon++) {
          const sweep = Math.sin(progress * Math.PI * 2 + event.phase + ribbon * 1.7);
          ctx.beginPath();
          ctx.ellipse(sweep * radius * .34, 0, radius * (1.05 + ribbon * .22), radius * (.18 + ribbon * .075), event.phase + ribbon * .23, .1 + progress, 2.2 + progress * 3.2);
          ctx.strokeStyle = rgba(ribbon === 1 ? '#c4e8ed' : color, fade * (.42 - ribbon * .09));
          ctx.lineWidth = ribbon === 0 ? 1.3 : .8;
          ctx.shadowColor = ribbon === 1 ? '#b6e6ef' : color;
          ctx.shadowBlur = this.mobile ? 7 : 13;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else if (event.type === 4) {
        const beat = (progress * 6) % 1;
        for (let ring = 0; ring < 4; ring++) {
          const ringProgress = (beat + ring * .25) % 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * (.24 + ringProgress * 1.2), radius * (.15 + ringProgress * .62), event.phase + ring * .4, 0, TAU);
          ctx.strokeStyle = rgba(ring % 2 ? '#f4d9b8' : '#e5e0ff', fade * (1 - ringProgress) * .46);
          ctx.lineWidth = ring === 0 ? 1.2 : .65;
          ctx.stroke();
        }
        const beam = event.phase + progress * TAU * 5;
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(beam) * radius * .2 * sign, Math.sin(beam) * radius * .2 * sign);
          ctx.lineTo(Math.cos(beam) * radius * 1.25 * sign, Math.sin(beam) * radius * 1.25 * sign);
          ctx.strokeStyle = rgba('#fff2dc', fade * .56);
          ctx.lineWidth = this.mobile ? 1.1 : 1.6;
          ctx.stroke();
        }
      } else if (event.type === 5) {
        const rays = this.mobile ? 16 : 28;
        for (let ray = 0; ray < rays; ray++) {
          const angle = ray / rays * TAU + event.phase;
          const inner = radius * (.12 + progress * .14);
          const outer = radius * (.55 + progress * 1.2) * (.78 + .22 * Math.sin(ray * 12.7 + event.phase));
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.strokeStyle = rgba(ray % 4 === 0 ? '#fff1d9' : color, fade * (ray % 2 ? .42 : .68));
          ctx.lineWidth = ray % 4 === 0 ? 1.2 : .65;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, radius * (.12 + progress * .76), 0, TAU);
        ctx.strokeStyle = rgba('#fff5e8', fade * .54);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (event.type === 6) {
        for (let tide = 0; tide < 2; tide++) {
          ctx.beginPath();
          const direction = tide ? -1 : 1;
          for (let step = 0; step <= 48; step++) {
            const t = step / 48;
            const angle = event.phase + direction * (t * TAU * 1.45 + progress * TAU * .8);
            const reach = radius * (.12 + t * (1.05 + progress * .72));
            const x = Math.cos(angle) * reach;
            const y = Math.sin(angle) * reach * .48;
            if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = rgba(tide ? '#d8c4ef' : color, fade * .62);
          ctx.lineWidth = tide ? 1 : 1.4;
          ctx.shadowColor = tide ? '#d8c4ef' : color;
          ctx.shadowBlur = this.mobile ? 5 : 10;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else {
        const orbit = progress * TAU * 1.4 + event.phase;
        const separation = radius * (.42 + .34 * Math.sin(progress * Math.PI));
        for (const sign of [-1, 1]) {
          const x = Math.cos(orbit) * separation * sign;
          const y = Math.sin(orbit) * separation * .55 * sign;
          ctx.beginPath();
          ctx.ellipse(x, y, radius * .48, radius * .23, orbit * sign, 0, TAU);
          ctx.strokeStyle = rgba(sign < 0 ? '#d9c8f0' : '#c5e4ed', fade * .56);
          ctx.lineWidth = 1;
          ctx.stroke();
          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * .5);
          glow.addColorStop(0, rgba('#fff6e8', fade * .82));
          glow.addColorStop(.24, rgba(sign < 0 ? '#d9c8f0' : color, fade * .44));
          glow.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, radius * .5, 0, TAU);
          ctx.fill();
        }
      }
      const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .56);
      flash.addColorStop(0, rgba('#fff9f0', fade * .78)); flash.addColorStop(.25, rgba(color, fade * .45)); flash.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = flash; ctx.beginPath(); ctx.arc(0, 0, radius * .56, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawSpiralArms(time) {
    const ctx = this.ctx;
    const arms = this.mobile ? 2 : 3;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let arm = 0; arm < arms; arm++) {
      const hue = arm === 0 ? '#bea3d9' : arm === 1 ? '#82a6c0' : '#d3b5a0';
      ctx.beginPath();
      for (let i = 0; i <= 190; i++) {
        const point = this.spiralPoint(arm, i / 190, time, this.spiralScratch);
        if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = rgba(hue, .065);
      ctx.lineWidth = this.mobile ? 14 : 24;
      ctx.shadowColor = hue;
      ctx.shadowBlur = this.mobile ? 8 : 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(hue, .21);
      ctx.lineWidth = this.mobile ? 1 : 1.25;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStars(time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const star of this.stars) {
      const driftX = star.drift * Math.sin(time * (.12 + star.depth * .08) + star.phase);
      const parallax = (this.pointer.x > 0 ? (this.pointer.x / this.width - .5) : 0) * star.depth * (this.mobile ? 2 : 7);
      const x = ((star.x + driftX + 1) % 1) * this.width + parallax;
      const y = (star.y + Math.sin(time * star.speed + star.phase) * (.001 + star.depth * .002)) * this.height;
      const twinkle = .62 + .38 * Math.sin(time * (1.2 + star.speed) + star.phase);
      const alpha = star.alpha * twinkle;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.warm ? '#f2d6b6' : '#e5e8ff';
      ctx.beginPath(); ctx.arc(x, y, star.size, 0, TAU); ctx.fill();
      if (star.size > 1.02 || star.foreground) {
        ctx.strokeStyle = rgba(star.warm ? '#e6c8a9' : '#cbd9ff', .22 * twinkle);
        ctx.lineWidth = star.foreground ? .75 : .45;
        const streak = star.foreground ? 5 + star.depth * 7 : star.size * 2.1;
        ctx.beginPath(); ctx.moveTo(x - streak, y - streak * .24); ctx.lineTo(x + streak, y + streak * .24); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawDust(time) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const palette = ['#d9c8e8', '#a9cbda', '#f0d7bd'];
    for (const speck of this.dust) {
      const x = ((speck.x + speck.vx * time * (.5 + speck.depth) + 1) % 1) * this.width;
      const y = ((speck.y + speck.vy * time * (.5 + speck.depth) + Math.sin(time * .16 + speck.phase) * .002) % 1) * this.height;
      const twinkle = .62 + .38 * Math.sin(time * (.55 + speck.depth * .45) + speck.phase);
      ctx.globalAlpha = speck.alpha * twinkle;
      ctx.fillStyle = palette[speck.tone];
      ctx.beginPath(); ctx.arc(x, y, speck.size * (.7 + speck.depth * .55), 0, TAU); ctx.fill();
      if (speck.depth > .82 && speck.size > 1) {
        ctx.strokeStyle = rgba(palette[speck.tone], .25 * twinkle); ctx.lineWidth = .5;
        ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  drawAmbientComets(time) {
    const ctx = this.ctx;
    const paths = [FLIGHT_PATHS[0], FLIGHT_PATHS[5]];
    const colors = ['#d9d2f2', '#b7dbe8'];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < paths.length; i++) {
      const progress = (time / (i === 0 ? 12.5 : 15.5) + i * .5) % 1;
      const head = cubicPoint(paths[i], progress, this.curveScratch);
      const tail = cubicPoint(paths[i], Math.max(0, progress - .045), this.spiralScratch);
      const x = head.x * this.width;
      const y = head.y * this.height;
      const tailX = tail.x * this.width;
      const tailY = tail.y * this.height;
      const edgeFade = Math.min(1, progress * 12, (1 - progress) * 12);
      ctx.globalAlpha = .56 * edgeFade;
      const trail = ctx.createLinearGradient(tailX, tailY, x, y);
      trail.addColorStop(0, rgba(colors[i], 0));
      trail.addColorStop(.72, rgba(colors[i], .13));
      trail.addColorStop(1, rgba(colors[i], .68));
      ctx.strokeStyle = trail;
      ctx.lineWidth = this.mobile ? 1.1 : 1.45;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = rgba(colors[i], .82 * edgeFade);
      ctx.beginPath();
      ctx.arc(x, y, this.mobile ? 1.8 : 2.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCore(time) {
    const ctx = this.ctx;
    const x = this.width * .5;
    const y = this.height * .51;
    const pulse = 1 + Math.sin(time * .48) * .035;
    const radius = Math.min(this.width, this.height) * (this.mobile ? .10 : .115) * pulse;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
    glow.addColorStop(0, 'rgba(246,224,245,.25)');
    glow.addColorStop(.18, 'rgba(189,164,220,.11)');
    glow.addColorStop(1, 'rgba(140,136,198,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, radius * 2.8, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * .018);
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * (1.12 + ring * .43), radius * (.31 + ring * .13), ring * .17, 0, TAU);
      ctx.strokeStyle = `rgba(212,196,236,${.18 - ring * .045})`;
      ctx.lineWidth = .7;
      ctx.stroke();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(x, y, 0, x, y, radius * .55);
    core.addColorStop(0, 'rgba(255,247,237,.9)');
    core.addColorStop(.35, 'rgba(217,193,228,.42)');
    core.addColorStop(1, 'rgba(177,165,220,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y, radius * .55, 0, TAU); ctx.fill();
  }

  drawMotif(recipient, x, y, radius, time, reaction, hovered) {
    const ctx = this.ctx;
    const color = recipient.palette?.[0] || '#b9acc5';
    const secondary = recipient.palette?.[1] || '#8290ad';
    const size = radius * (1 + reaction * .12 + (hovered ? .1 : 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * .15 + Number(recipient.number || 0)) * .045);
    ctx.globalCompositeOperation = 'screen';

    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    halo.addColorStop(0, rgba(color, .25 + reaction * .18 + (hovered ? .1 : 0)));
    halo.addColorStop(.43, rgba(secondary, .12 + reaction * .09));
    halo.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, size * 2.5, 0, TAU); ctx.fill();

    ctx.strokeStyle = rgba(color, .36 + reaction * .36 + (hovered ? .22 : 0));
    ctx.lineWidth = this.mobile ? .78 : 1;
    ctx.beginPath(); ctx.ellipse(0, 0, size * 1.28, size * .63, -.31, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(secondary, .26 + reaction * .25);
    ctx.beginPath(); ctx.ellipse(0, 0, size * 1.03, size * .43, .57, 0, TAU); ctx.stroke();

    ctx.beginPath();
    const points = 70;
    const motif = recipient.motif;
    for (let i = 0; i <= points; i++) {
      const t = i / points * TAU;
      let r = size * .62;
      let px, py;
      if (motif === 'rose') {
        r *= .18 + .82 * Math.abs(Math.cos(2.5 * t));
        px = Math.cos(t) * r; py = Math.sin(t) * r;
      } else if (motif === 'lemniscate') {
        const d = 1 + Math.sin(t) ** 2;
        px = size * .77 * Math.cos(t) / d;
        py = size * .52 * Math.sin(t) * Math.cos(t) / d;
      } else if (motif === 'phyllotaxis') {
        const radiusProgress = i / points;
        const angle = i * 2.399963 + time * .03;
        px = Math.cos(angle) * size * .76 * Math.sqrt(radiusProgress);
        py = Math.sin(angle) * size * .76 * Math.sqrt(radiusProgress);
      } else if (motif === 'orbit') {
        px = Math.cos(t) * size * .79; py = Math.sin(t) * size * .48;
      } else if (motif === 'superformula') {
        const cosine = Math.pow(Math.abs(Math.cos(1.25 * t)), 1.7);
        const sine = Math.pow(Math.abs(Math.sin(1.25 * t)), 1.7);
        const denominator = Math.pow(Math.max(.08, cosine + sine), 1 / .55);
        r = size * .66 / denominator;
        px = Math.cos(t) * r; py = Math.sin(t) * r;
      } else if (motif === 'wave') {
        r = size * (.4 + .21 * Math.sin(3 * t));
        px = Math.cos(t) * r; py = Math.sin(t) * r;
      } else if (motif === 'spiral') {
        r = size * (.06 + .68 * i / points);
        px = Math.cos(t * 2.2) * r; py = Math.sin(t * 2.2) * r;
      } else if (motif === 'epicycle') {
        px = size * (.45 * Math.cos(t) + .27 * Math.cos(2.4 * t));
        py = size * (.4 * Math.sin(t) + .25 * Math.sin(2.4 * t));
      } else {
        const wing = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.sin(t / 12) ** 5;
        px = size * .12 * Math.sin(t) * wing;
        py = size * .105 * Math.cos(t) * wing;
      }
      if (!Number.isFinite(px) || !Number.isFinite(py)) { px = 0; py = 0; }
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(color, .78 + reaction * .15);
    ctx.lineWidth = this.mobile ? 1.05 : 1.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.mobile ? 4 : 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const star = ctx.createRadialGradient(0, 0, 0, 0, 0, size * .35);
    star.addColorStop(0, 'rgba(255,250,245,.96)');
    star.addColorStop(.25, rgba(color, .7));
    star.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = star;
    ctx.beginPath(); ctx.arc(0, 0, size * .35, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawNodes(time) {
    const ctx = this.ctx;
    for (let i = 0; i < this.recipients.length; i++) {
      const recipient = this.recipients[i];
      const point = this.nodePoint(i);
      const reaction = this.nodeReactions[i];
      const hovered = i === this.hoverIndex;
      const radius = Math.min(this.width, this.height) * (this.mobile ? .022 : .026) * this.galaxySeeds[i].depth;
      this.drawMotif(recipient, point.x, point.y, radius, time + i * .23, reaction, hovered);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = this.mobile ? '700 10px "Manrope", system-ui, sans-serif' : '700 12px "Manrope", system-ui, sans-serif';
      ctx.letterSpacing = this.mobile ? '.02em' : '.05em';
      ctx.shadowColor = 'rgba(5,5,15,.98)';
      ctx.shadowBlur = 9;
      ctx.fillStyle = hovered ? '#fff9f0' : 'rgba(244,239,251,.96)';
      const labelRadius = Math.min(this.width, this.height) * (this.mobile ? .071 : .084) * this.galaxySeeds[i].depth;
      const labelY = point.y + labelRadius * 1.56;
      const label = recipient.display || recipient.name;
      const maxWidth = this.mobile ? Math.min(112, this.width * .31) : 175;
      ctx.fillText(label, point.x, labelY, maxWidth);
      ctx.restore();
    }
  }

  drawRipples() {
    const ctx = this.ctx;
    for (const ripple of this.ripples) {
      const progress = ripple.age / .95;
      const radius = 10 + progress * (this.mobile ? 60 : 95);
      ctx.strokeStyle = `rgba(199,184,234,${(1 - progress) * .45})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ripple.x, ripple.y, radius, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(135,184,205,${(1 - progress) * .23})`;
      ctx.beginPath(); ctx.arc(ripple.x, ripple.y, radius * .63, 0, TAU); ctx.stroke();
    }
  }

  drawComet(time) {
    if (!this.comet) return;
    const ctx = this.ctx;
    const comet = this.comet;
    const progress = clamp(comet.elapsed / comet.duration, 0, 1);
    const dissipation = clamp((comet.duration + .45 - comet.elapsed) / .45, 0, 1);
    const point = comet;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // A curved, layered wake. Particle count is bounded and trails are owned by this one event.
    const p = comet.path;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      const samples = 58;
      const back = layer === 0 ? .32 : layer === 1 ? .235 : .15;
      for (let i = 0; i <= samples; i++) {
        const t = clamp(progress - (i / samples) * back, 0, 1);
        const q = cubicPoint(p, Math.pow(t, 1.22), this.curveScratch);
        const x = q.x * this.width;
        const y = q.y * this.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const color = layer === 0 ? '#fff0df' : layer === 1 ? '#cbb9ef' : '#88c3d8';
      ctx.strokeStyle = rgba(color, (layer === 0 ? .8 : layer === 1 ? .34 : .17) * dissipation);
      ctx.lineWidth = layer === 0 ? 1.35 : layer === 1 ? (this.mobile ? 4 : 7) : (this.mobile ? 11 : 18);
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = layer === 0 ? 12 : layer === 1 ? 16 : 23;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    for (const particle of comet.trail) {
      const ageFade = clamp(1 - particle.age / .62, 0, 1);
      const radius = (this.mobile ? .7 : 1.1) + ageFade * (this.mobile ? 1.25 : 2.0);
      ctx.globalAlpha = ageFade * .78 * dissipation;
      ctx.fillStyle = particle.age < .11 ? '#fff0db' : '#b8bce8';
      ctx.beginPath(); ctx.arc(particle.x, particle.y, radius, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const pulse = 1 + .12 * Math.sin(time * 18 + comet.seed);
    const radius = (this.mobile ? 14 : 19) * pulse;
    const corona = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.8);
    corona.addColorStop(0, `rgba(255,249,229,${.95 * dissipation})`);
    corona.addColorStop(.17, `rgba(255,225,203,${.76 * dissipation})`);
    corona.addColorStop(.4, `rgba(212,185,245,${.2 * dissipation})`);
    corona.addColorStop(1, 'rgba(175,183,235,0)');
    ctx.fillStyle = corona;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius * 2.8, 0, TAU); ctx.fill();
    ctx.globalAlpha = dissipation;
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath(); ctx.arc(point.x, point.y, this.mobile ? 2.2 : 3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.canvas?.removeEventListener('pointermove', this.boundMove);
    this.canvas?.removeEventListener('pointerleave', this.boundLeave);
    this.canvas?.removeEventListener('pointerdown', this.boundDown);
    this.canvas?.removeEventListener('pointerup', this.boundUp);
    this.canvas?.removeEventListener('pointercancel', this.boundUp);
    window.removeEventListener('resize', this.boundResize);
    window.visualViewport?.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.cometButton?.removeEventListener('click', this.boundComet);
    for (const [button, activate] of this.accessibleBindings) button.removeEventListener('click', activate);
    this.accessibleBindings.length = 0;
    this.accessibleNodeGroup?.replaceChildren();
  }
}
