import { gsap } from 'gsap';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';
import { GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES, hashGalaxySeed } from '../data/galaxyProfiles.js';

const DEFAULT_PALETTE = [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.periwinkle, COSMIC_COLORS.champagne];
const TAU = Math.PI * 2;

/**
 * Low-power Canvas 2D renderer used when WebGL cannot start or is lost.
 * It caps the frame rate and device-pixel ratio, and stops its RAF entirely
 * while the document is hidden so fallback mode stays cool on mobile devices.
 */
export class FallbackScene {
  constructor(canvas, { onPhase = () => {}, onBurst = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d', { alpha: true, desynchronized: true }) || null;
    this.onPhase = onPhase;
    this.onBurst = onBurst;
    this.palette = DEFAULT_PALETTE.slice();
    this.stars = [];
    this.comets = [];
    this.time = 0;
    this.lastFrame = 0;
    this.raf = 0;
    this.hidden = document.hidden;
    this.disposed = false;
    this.paused = false;
    this.person = null;
    this.titlePoints = [];
    this.galaxyProfile = GALAXY_PROFILES.twinSpiral;
    this.galaxyParticles = [];
    this.galaxySeed = 2010;
    this.galaxyParticles = this.makeGalaxyParticles();
    this.pointScratch = { x: 0, y: 0 };
    this.cosmicEvent = null;
    this.cosmicTimeline = null;
    this.eventTimeline = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
    this.frameBudget = this.reducedMotion ? 1000 / 18 : (this.mobile ? 1000 / 30 : 1000 / 36);

    this.boundResize = this.resize.bind(this);
    this.boundFrame = this.frame.bind(this);
    this.boundVisibility = this.onVisibility.bind(this);
    window.addEventListener('resize', this.boundResize, { passive: true });
    window.addEventListener('orientationchange', this.boundResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.resize();
    if (this.ctx && !this.hidden) this.start();
    else if (!this.ctx) this.applyCssFallback();
  }

  applyCssFallback() {
    // Even if Canvas 2D is unavailable, CSS gradients still provide a calm
    // nebula backdrop while the HTML interface remains fully interactive.
    this.canvas.classList.add('fallback-css-mode');
    document.body.classList.add('is-css-fallback');
    this.canvas.style.backgroundColor = COSMIC_COLORS.space;
    this.canvas.style.backgroundImage = [
      'radial-gradient(ellipse at 20% 35%, rgba(164,134,155,.24), transparent 42%)',
      'radial-gradient(ellipse at 76% 28%, rgba(130,144,173,.18), transparent 38%)',
      'radial-gradient(ellipse at 58% 78%, rgba(185,164,133,.05), transparent 34%)',
      'radial-gradient(circle at 15% 20%, rgba(255,255,255,.66) 0 1px, transparent 1.6px)',
      'radial-gradient(circle at 74% 62%, rgba(255,255,255,.5) 0 1px, transparent 1.5px)'
    ].join(',');
  }

  resize() {
    if (this.disposed) return;
    const oldWidth = this.w || Math.max(1, window.innerWidth);
    const oldHeight = this.h || Math.max(1, window.innerHeight);
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.mobile = matchMedia('(pointer: coarse)').matches || this.w < 720;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1 : 1.2);
    this.frameBudget = this.reducedMotion ? 1000 / 18 : (this.mobile ? 1000 / 30 : 1000 / 36);

    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
      this.canvas.style.width = `${this.w}px`;
      this.canvas.style.height = `${this.h}px`;
    }
    if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Re-map existing particles through viewport changes rather than reseeding
    // the entire field on every mobile browser chrome/orientation resize.
    const ratioX = this.w / Math.max(1, oldWidth);
    const ratioY = this.h / Math.max(1, oldHeight);
    for (const star of this.stars) {
      star.x *= ratioX;
      star.y *= ratioY;
    }
    if (!this.stars.length) this.seedStars();
    if (!this.comets.length) this.seedComets();
    this.lastFrame = 0;
    if (!this.ctx) this.applyCssFallback();
    if (!this.hidden && !this.paused && this.ctx) this.start();
  }

  seedStars() {
    const count = this.mobile ? 260 : 520;
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: Math.random() * (this.mobile ? 0.85 : 1.1) + 0.15,
      speed: Math.random() * 5 + 1.5,
      phase: Math.random() * TAU,
      color: Math.floor(Math.random() * this.palette.length)
    }));
  }

  seedComets() {
    const count = this.mobile ? 1 : 2;
    this.comets = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h * 0.75,
      vx: (i % 2 ? -1 : 1) * (this.mobile ? 30 : 44),
      vy: i % 2 ? -8 : 7,
      length: this.mobile ? 34 : 58,
      phase: Math.random() * TAU,
      color: i % this.palette.length
    }));
  }

  start() {
    if (this.disposed || this.paused || this.hidden || !this.ctx || this.raf) return;
    this.raf = requestAnimationFrame(this.boundFrame);
  }

  pause() {
    if (this.disposed || this.paused) return;
    this.paused = true;
    this.lastFrame = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume() {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    this.lastFrame = 0;
    this.start();
  }

  onVisibility() {
    this.hidden = document.hidden;
    this.lastFrame = 0;
    if (this.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.paused) {
      this.start();
    }
  }

  setPalette(palette) {
    if (Array.isArray(palette) && palette.length) this.palette = palette.slice(0, 4);
  }

  setRecipient(person) {
    this.person = person || null;
    this.titlePoints = person ? this.makeTitlePoints(person.display || person.name || '') : [];
    const profileKey = person ? RECIPIENT_GALAXY_PROFILES[person.id] : null;
    this.galaxyProfile = profileKey ? GALAXY_PROFILES[profileKey] : null;
    this.galaxySeed = person ? hashGalaxySeed(person.id || person.display || person.name) : 1;
    this.galaxyParticles = this.galaxyProfile ? this.makeGalaxyParticles() : [];
    if (person?.palette) this.setPalette(person.palette);
  }

  makeGalaxyParticles() {
    const profile = this.galaxyProfile;
    let seed = this.galaxySeed;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = this.mobile ? 300 : 520;
    const particles = new Array(count);
    for (let i = 0; i < count; i++) {
      const population = random();
      let radius;
      let angle;
      let arm = 0;
      if (population < 0.19) {
        radius = Math.sqrt(random()) * 0.24 * profile.core;
        angle = random() * TAU;
      } else if (population < 0.76) {
        arm = Math.floor(random() * profile.arms);
        const progress = random();
        radius = 0.12 + progress * 0.8;
        angle = progress * TAU * (profile.morphology === 'ribbon' ? 1.15 : 2.05) +
          arm * TAU / profile.arms + profile.phase;
        radius += (random() - 0.5) * profile.thickness * 0.16;
      } else {
        radius = 0.48 + Math.sqrt(random()) * 0.7 * profile.halo;
        angle = random() * TAU;
      }
      particles[i] = {
        radius,
        angle,
        arm,
        phase: random() * TAU,
        size: 0.45 + random() * (population < 0.19 ? 1.45 : 0.8),
        color: Math.floor(random() * this.palette.length),
        population
      };
    }
    return particles;
  }

  galaxyPoint(progress, arm) {
    const profile = this.galaxyProfile;
    const arms = profile.armCount || profile.arms;
    let pitchAdjustment = 0;
    switch (profile.curve) {
      case 'lemniscate': pitchAdjustment = -0.012; break;
      case 'trochoid': pitchAdjustment = 0.018; break;
      case 'rose': pitchAdjustment = -0.022; break;
      case 'superformula': pitchAdjustment = 0.012; break;
      case 'logSpiral': pitchAdjustment = 0.028; break;
      case 'lissajous': pitchAdjustment = -0.008; break;
      case 'phyllotaxis': pitchAdjustment = -0.018; break;
      case 'epicycle': pitchAdjustment = 0.022; break;
      case 'butterfly': pitchAdjustment = 0.008; break;
      default: break;
    }
    const pitch = Math.max(0.12, profile.pitch + pitchAdjustment);
    const turns = 0.62 + pitch * 0.5;
    const angleStep = TAU * turns;
    const angle = profile.phase + arm * TAU / arms + progress * angleStep;
    const growth = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2) * (1.1 + pitch * 0.72);
    const normalizedRadius = (Math.exp(growth * progress * angleStep) - 1)
      / (Math.exp(growth * angleStep) - 1);
    const radius = 0.12 + normalizedRadius * 0.78;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * 0.8;
    this.pointScratch.x = x;
    this.pointScratch.y = y;
    return this.pointScratch;
  }

  playCosmicEvent(name, { sequence = 0, idle = false } = {}) {
    if ((!this.person && !idle) || this.disposed) return null;
    this.stopCosmicEvent();
    const rect = document.querySelector('#reveal')?.getBoundingClientRect();
    const portal = idle ? document.querySelector('#portal')?.getBoundingClientRect() : null;
    const bounds = idle && portal?.width
      ? portal
      : rect?.width ? rect : { left: this.w * 0.34, right: this.w * 0.66, top: this.h * 0.62, bottom: this.h * 0.9 };
    const centerX = Math.max(14, Math.min(this.w - 14, (bounds.left + bounds.right) * 0.5));
    const centerY = idle
      ? Math.max(14, Math.min(this.h * 0.42, bounds.top * 0.38))
      : Math.max(14, Math.min(this.h - 14, bounds.top - 90));
    this.cosmicEvent = { name, sequence, centerX, centerY, progress: 0, intensity: 0 };
    const event = this.cosmicEvent;
    const timeline = gsap.timeline({
      onComplete: () => {
        if (this.cosmicEvent === event) this.cosmicEvent = null;
        this.cosmicTimeline = null;
      }
    });
    this.cosmicTimeline = timeline;
    const reduced = this.reducedMotion;
    const prep = reduced ? 0.32 : 0.62;
    const impact = reduced ? 0.55 : 0.92;
    timeline
      .to(event, { intensity: 0.52, progress: 0.24, duration: prep, ease: 'sine.inOut' });
    if (name === 'stellarSupernova') {
      timeline.call(() => this.onBurst())
        .to(event, { intensity: 0.96, progress: 0.82, duration: impact, ease: 'expo.out' })
        .to(event, { intensity: 0, progress: 1, duration: reduced ? 0.42 : 0.78, ease: 'sine.out' });
    } else {
      timeline.to(event, { intensity: 0.82, progress: 0.82, duration: impact, ease: 'power2.inOut' })
        .to(event, { intensity: 0, progress: 1, duration: reduced ? 0.42 : 0.78, ease: 'sine.out' });
    }
    return timeline;
  }

  stopCosmicEvent() {
    this.cosmicTimeline?.kill();
    this.cosmicTimeline = null;
    this.cosmicEvent = null;
  }

  drawCosmicEvent(ctx) {
    const event = this.cosmicEvent;
    if (!event?.intensity) return;
    const progress = event.progress;
    const intensity = event.intensity * (1 - Math.max(0, progress - 0.84) / 0.16);
    const radius = Math.min(this.w, this.h) * (event.idle ? 0.14 : 0.18);
    const x = event.centerX;
    const y = event.centerY;
    const profile = this.galaxyProfile;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    if (event.name === 'stellarSupernova') {
      const burst = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * (0.25 + progress * 2.1));
      burst.addColorStop(0, 'rgba(255,245,224,.92)');
      burst.addColorStop(0.12, `${this.palette[2 % this.palette.length]}aa`);
      burst.addColorStop(0.44, `${this.palette[0]}66`);
      burst.addColorStop(1, 'rgba(130,144,173,0)');
      ctx.fillStyle = burst;
      ctx.beginPath(); ctx.arc(0, 0, radius * (0.25 + progress * 2.1), 0, TAU); ctx.fill();
      for (let ray = 0; ray < 28; ray++) {
        const angle = ray * TAU / 28 + this.time * 0.04;
        const reach = radius * (0.4 + 1.9 * progress) * (0.55 + 0.45 * Math.sin(ray * 12.7));
        ctx.strokeStyle = this.palette[ray % this.palette.length];
        ctx.globalAlpha = intensity * (0.12 + 0.16 * (ray % 3 === 0));
        ctx.lineWidth = ray % 4 === 0 ? 2 : 0.8;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * 0.12, Math.sin(angle) * radius * 0.12);
        ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach); ctx.stroke();
      }
    } else if (event.name === 'meteorStorm') {
      for (let meteor = 0; meteor < 13; meteor++) {
        const travel = (progress * 1.4 + meteor * 0.137) % 1;
        const lane = (meteor - 6) * radius * 0.13;
        const headX = (travel - 0.5) * this.w * 0.74;
        const headY = lane + Math.sin(travel * TAU + meteor) * radius * 0.22;
        const trail = ctx.createLinearGradient(headX - radius * 0.52, headY + radius * 0.22, headX, headY);
        trail.addColorStop(0, 'rgba(255,255,255,0)');
        trail.addColorStop(1, `${this.palette[meteor % this.palette.length]}dd`);
        ctx.strokeStyle = trail; ctx.lineWidth = meteor % 4 === 0 ? 2.2 : 1.1;
        ctx.beginPath(); ctx.moveTo(headX - radius * 0.52, headY + radius * 0.22); ctx.lineTo(headX, headY); ctx.stroke();
      }
    } else if (event.name === 'mathematicalBloom') {
      ctx.scale(radius * 0.86, radius * 0.86);
      ctx.strokeStyle = this.palette[2 % this.palette.length];
      ctx.lineWidth = 0.009;
      ctx.globalAlpha = intensity * 0.62;
      const profileArm = sequence % Math.max(1, profile?.arms || 4);
      ctx.beginPath();
      const steps = Math.floor(150 * progress);
      for (let step = 0; step <= steps; step++) {
        const point = this.galaxyPoint(step / 150, profileArm);
        if (step === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    } else if (event.name === 'centrifugalRift' || event.name === 'stardustRebirth') {
      ctx.rotate(progress * (event.name === 'centrifugalRift' ? 1.8 : -1.2));
      for (let band = 0; band < 4; band++) {
        ctx.beginPath();
        for (let step = 0; step <= 90; step++) {
          const t = step / 90;
          const angle = t * TAU * (1.15 + band * 0.16) + band * TAU / 4;
          const r = radius * (0.12 + t * (0.52 + band * 0.1) + 0.04 * Math.sin(angle * 3));
          if (step === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.strokeStyle = this.palette[band % this.palette.length];
        ctx.globalAlpha = intensity * 0.24;
        ctx.lineWidth = band === 0 ? 1.8 : 0.9;
        ctx.stroke();
      }
    } else if (event.name === 'cosmicConstellation') {
      for (let node = 0; node < 12; node++) {
        const angle = node * 2.399963 + (this.galaxyProfile?.phase ?? 0);
        const r = radius * (0.25 + 0.62 * (node % 5) / 4);
        const nx = Math.cos(angle) * r;
        const ny = Math.sin(angle) * r * 0.65;
        if (node > 0 && node < 9 && progress > node / 12) {
          const priorAngle = (node - 1) * 2.399963 + (this.galaxyProfile?.phase ?? 0);
          ctx.strokeStyle = this.palette[node % this.palette.length];
          ctx.globalAlpha = intensity * 0.32;
          ctx.beginPath(); ctx.moveTo(Math.cos(priorAngle) * r * 0.72, Math.sin(priorAngle) * r * 0.47); ctx.lineTo(nx, ny); ctx.stroke();
        }
        ctx.fillStyle = this.palette[node % this.palette.length];
        ctx.globalAlpha = intensity * 0.76;
        ctx.beginPath(); ctx.arc(nx, ny, 1.4 + (node % 3) * 0.45, 0, TAU); ctx.fill();
      }
    } else {
      for (let ring = 0; ring < 4; ring++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (0.32 + progress * 1.05 + ring * 0.11), radius * (0.2 + progress * 0.74 + ring * 0.07), ring * 0.18 + this.time * 0.02, 0, TAU);
        ctx.strokeStyle = this.palette[ring % this.palette.length];
        ctx.globalAlpha = intensity * (0.24 - ring * 0.035);
        ctx.lineWidth = ring === 0 ? 2.4 : 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawGalaxy(ctx) {
    const profile = this.galaxyProfile;
    if (!profile) return;
    const centerX = this.w * 0.5;
    const centerY = this.h * 0.47;
    const radius = Math.min(this.w * 0.47, this.h * 0.42);
    const inclination = (profile.inclination ?? 22) * Math.PI / 180;
    const rotation = (profile.rotate ?? 0) * Math.PI / 180;
    const ellipseScale = Math.cos(inclination);
    const transport = this.time * (0.006 + profile.flow * 0.028);
    const revealRect = this.person ? document.querySelector('#reveal')?.getBoundingClientRect() : null;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.scale(radius, radius * ellipseScale);

    const nebula = ctx.createRadialGradient(0, 0, 0.04, 0, 0, 1.16);
    nebula.addColorStop(0, `${this.palette[2 % this.palette.length]}${Math.round((profile.nebulaOpacity ?? 0.7) * 32).toString(16).padStart(2, '0')}`);
    nebula.addColorStop(0.42, `${this.palette[1 % this.palette.length]}16`);
    nebula.addColorStop(1, `${this.palette[0]}00`);
    ctx.fillStyle = nebula;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(-1.16, -1.16, 2.32, 2.32);

    const bulge = ctx.createRadialGradient(0, 0, 0.01, 0, 0, 0.44 * (profile.bulgeSize ?? 1));
    bulge.addColorStop(0, 'rgba(255, 238, 211, 0.42)');
    bulge.addColorStop(0.32, `${this.palette[2 % this.palette.length]}44`);
    bulge.addColorStop(1, `${this.palette[2 % this.palette.length]}00`);
    ctx.fillStyle = bulge;
    ctx.fillRect(-0.48, -0.48, 0.96, 0.96);

    const halo = ctx.createRadialGradient(0, 0, 0.54, 0, 0, 1.34);
    halo.addColorStop(0, `${this.palette[0]}00`);
    halo.addColorStop(0.52, `${this.palette[1 % this.palette.length]}13`);
    halo.addColorStop(1, `${this.palette[0]}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(-1.34, -1.34, 2.68, 2.68);

    for (const particle of this.galaxyParticles) {
      let x;
      let y;
      let envelope = 1;
      if (particle.population >= 0.19 && particle.population < 0.76) {
        const progress = Math.max(0, Math.min(1, (particle.radius - 0.12) / 0.8));
        const movingProgress = (progress + transport) % 1;
        const delta = movingProgress - progress;
        const point = this.galaxyPoint(movingProgress, particle.arm);
        const radialOffset = particle.radius - (0.1 + progress * 0.82);
        const angle = movingProgress * TAU * 2.05
          + particle.arm * TAU / profile.arms + profile.phase;
        const radialScale = Math.exp(delta * 2.05 * 0.16);
        x = point.x + Math.cos(angle) * radialOffset * radialScale;
        y = point.y + Math.sin(angle) * radialOffset * radialScale;
        const entry = Math.max(0, Math.min(1, movingProgress / 0.14));
        const exit = Math.max(0, Math.min(1, (1 - movingProgress) / 0.14));
        envelope = Math.max(0.42, entry * entry * (3 - 2 * entry) * exit * exit * (3 - 2 * exit));
      } else {
        const angle = particle.angle + this.time * profile.spin * (particle.population < 0.19 ? 0.055 : 0.018);
        const pulse = 1 + 0.025 * Math.sin(this.time * (1 + profile.pulse) + particle.phase);
        x = Math.cos(angle) * particle.radius * pulse;
        y = Math.sin(angle) * particle.radius * pulse;
      }
      const pulse = 1 + 0.025 * Math.sin(this.time * (1 + profile.pulse) + particle.phase);
      x *= pulse;
      y *= pulse;
      const projectedX = Math.cos(rotation) * x - Math.sin(rotation) * y * ellipseScale;
      const projectedY = Math.sin(rotation) * x + Math.cos(rotation) * y * ellipseScale;
      const screenX = centerX + projectedX * radius;
      const screenY = centerY + projectedY * radius;
      const titleDistance = Math.hypot(
        (screenX - this.w * 0.5) / Math.max(1, this.w * 0.35),
        (screenY - this.h * 0.39) / Math.max(1, this.h * 0.11)
      );
      const nameZone = 1 - Math.max(0, Math.min(1, (titleDistance - 0.68) / 0.82));
      const wishDistance = revealRect?.width ? Math.hypot(
        (screenX - (revealRect.left + revealRect.right) * 0.5) / (revealRect.width * 0.5 + 28),
        (screenY - (revealRect.top + revealRect.bottom) * 0.5) / (revealRect.height * 0.5 + 24)
      ) : 2;
      const wishZone = 1 - Math.max(0, Math.min(1, (wishDistance - 0.68) / 0.82));
      const titleOcclusion = Math.max(nameZone, wishZone) * (0.48 + 0.52 * (particle.phase % 1));
      const shimmer = 0.28 + 0.48 * (0.5 + 0.5 * Math.sin(this.time * (0.8 + profile.pulse) + particle.phase));
      ctx.globalAlpha = shimmer * (1 - titleOcclusion * 0.58) * envelope
        * (particle.population < 0.19 ? 0.9 : 0.72);
      ctx.fillStyle = this.palette[particle.color % this.palette.length];
      ctx.beginPath();
      ctx.arc(x, y, particle.size / radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    const coreRadius = Math.max(14, radius * 0.11 * profile.core);
    const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2.8);
    core.addColorStop(0, 'rgba(255,239,218,0.48)');
    core.addColorStop(0.28, `${this.palette[2 % this.palette.length]}55`);
    core.addColorStop(1, 'rgba(17,18,30,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius * 2.8, 0, TAU);
    ctx.fill();
  }

  makeTitlePoints(text) {
    const mask = document.createElement('canvas');
    mask.width = 1400;
    mask.height = 300;
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    const upper = text.toLocaleUpperCase('vi-VN');
    let fontSize = 190;
    ctx.font = `900 ${fontSize}px "Nunito Sans", Arial, sans-serif`;
    const width = ctx.measureText(upper).width;
    if (width > 1260) {
      fontSize = Math.floor(fontSize * 1260 / width);
      ctx.font = `900 ${fontSize}px "Nunito Sans", Arial, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(upper, 700, 150);
    const pixels = ctx.getImageData(0, 0, mask.width, mask.height).data;
    const points = [];
    for (let y = 30; y < mask.height - 20; y += 7) {
      for (let x = 35; x < mask.width - 35; x += 7) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 96) points.push([(x - 700) / 1260, (y - 150) / 220]);
      }
    }
    return points;
  }

  triggerBomb(person, done = () => {}) {
    if (this.disposed) return;
    this.eventTimeline?.kill();
    this.setRecipient(person || null);
    this.setPalette(person?.palette || DEFAULT_PALETTE);
    this.onPhase('charge');
    if (this.reducedMotion) {
      this.onPhase('burst');
      this.onBurst();
      this.onPhase('reform');
      this.onPhase('settled');
      done();
      return null;
    }
    this.eventTimeline = gsap.timeline({ onComplete: done })
      .to({}, { duration: 0.55 })
      .call(() => { this.onPhase('burst'); this.onBurst(); })
      .to({}, { duration: 0.45 })
      .call(() => this.onPhase('reform'))
      .to({}, { duration: 0.75 })
      .call(() => this.onPhase('settled'));
    return this.eventTimeline;
  }

  resetToIdle() {
    this.stopCosmicEvent();
    this.eventTimeline?.kill();
    this.eventTimeline = null;
    this.person = null;
    this.titlePoints = [];
    this.galaxyProfile = GALAXY_PROFILES.twinSpiral;
    this.galaxySeed = 2010;
    this.galaxyParticles = this.makeGalaxyParticles();
    this.stopCosmicEvent();
    this.setPalette(DEFAULT_PALETTE);
    this.onPhase('idle');
  }

  frame(now) {
    this.raf = 0;
    if (this.disposed || this.paused || this.hidden || !this.ctx) return;
    if (this.lastFrame && now - this.lastFrame < this.frameBudget - 1) {
      this.raf = requestAnimationFrame(this.boundFrame);
      return;
    }
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.time += dt * (this.reducedMotion ? 0.25 : 1);
    this.draw(dt);
    this.raf = requestAnimationFrame(this.boundFrame);
  }

  draw(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // A small number of translucent glows replaces expensive post-processing.
    const glow = ctx.createRadialGradient(this.w * 0.48, this.h * 0.42, 0, this.w * 0.48, this.h * 0.42, Math.max(this.w, this.h) * 0.64);
    glow.addColorStop(0, 'rgba(164,134,155,0.11)');
    glow.addColorStop(0.52, 'rgba(130,144,173,0.035)');
    glow.addColorStop(1, 'rgba(17,18,30,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > this.h + 2) { star.y = -2; star.x = Math.random() * this.w; }
      const shimmer = 0.24 + 0.42 * (0.5 + 0.5 * Math.sin(this.time * 1.1 + star.phase));
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = this.palette[star.color % this.palette.length];
      ctx.beginPath();
      ctx.arc(star.x + Math.sin(this.time * 0.16 + star.phase) * 3.5, star.y, star.r, 0, TAU);
      ctx.fill();
    }

    this.drawGalaxy(ctx);
    this.drawCosmicEvent(ctx);

    for (const comet of this.comets) {
      comet.x += comet.vx * dt; comet.y += comet.vy * dt;
      if (comet.x < -comet.length - 10 || comet.x > this.w + comet.length + 10 || comet.y < -30 || comet.y > this.h + 30) {
        comet.x = comet.vx > 0 ? -comet.length : this.w + comet.length;
        comet.y = Math.random() * this.h * 0.76;
      }
      const tailX = comet.x - Math.sign(comet.vx) * comet.length;
      const tailY = comet.y - comet.vy * 0.65;
      const trail = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
      trail.addColorStop(0, 'rgba(255,255,255,0)');
      trail.addColorStop(0.7, `${this.palette[comet.color]}55`);
      trail.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.globalAlpha = 0.62;
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(comet.x, comet.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Keep the fallback readable and calm; the primary HTML interface contains
    // personalized text, while this low-key wordmark preserves the 20/10 motif.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!this.person) {
      const words = ['HNUE', 'SMCS', 'K75CLC'];
      const word = words[Math.floor(this.time / 3.8) % words.length];
      ctx.font = `600 ${Math.min(60, this.w * 0.115)}px "Manrope", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,230,248,0.78)';
      ctx.fillText(word, this.w / 2, this.h * 0.39);
      ctx.font = `12px monospace`;
      ctx.fillStyle = 'rgba(185,164,133,0.38)';
      ctx.fillText('20 · 10  /  HNUE', this.w / 2, this.h * 0.39 + Math.min(56, this.w * 0.1));
    } else {
      const scale = Math.min(this.w * 0.86, 1040) / 1260;
      const centerY = this.h * 0.39;
      this.titlePoints.forEach(([x, y], index) => {
        const shimmer = 0.52 + 0.22 * Math.sin(this.time * 0.8 + index * 0.19);
        ctx.globalAlpha = shimmer;
        ctx.fillStyle = this.palette[index % this.palette.length];
        ctx.beginPath();
        ctx.arc(this.w / 2 + x * scale * 1260, centerY + y * scale * 220, 0.9 + (index % 3) * 0.22, 0, TAU);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopCosmicEvent();
    this.eventTimeline?.kill();
    this.eventTimeline = null;
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('orientationchange', this.boundResize);
    window.visualViewport?.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.stars.length = 0;
    this.comets.length = 0;
    this.galaxyParticles.length = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w || 0, this.h || 0);
  }
}
