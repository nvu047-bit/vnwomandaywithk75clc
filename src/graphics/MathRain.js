import { COSMIC_COLORS } from '../data/cosmicPalette.js';

const FORMULAS = [
  'e^{iπ} + 1 = 0', '∫₀^π sin(x) dx = 2', 'r = a cos(5θ)',
  '∇ × F = 0', 'φ = 1.618033…', 'x² + y² = r²',
  'lim  sin(x)/x = 1', 'z = x + iy', '∑ 1/n² = π²/6',
  'dy/dx = f\'(x)', 'θₙ = n · 137.5°', '∮ F · dr'
];
const DIGITS = '314159265358979323846264338327950288419716939937510';
const SYMBOLS = 'π∑∫√∞∂Δθλφ∇≈≠≤≥∴⊕⊗';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEFAULT_PALETTE = [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.periwinkle, COSMIC_COLORS.champagne];

export class MathRain {
  constructor(canvas, gsap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.gsap = gsap;
    this.time = 0;
    this.last = 0;
    this.raf = 0;
    this.hidden = document.hidden;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.energy = 0.42;
    this.bursts = [];
    this.zones = [];
    this.zoneClock = 0;
    this.palette = DEFAULT_PALETTE.slice();
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.visibility = () => { this.hidden = document.hidden; this.last = 0; if (!this.hidden && !this.raf) this.raf = requestAnimationFrame(this.frame); };
    window.addEventListener('resize', this.resize, { passive: true });
    document.addEventListener('visibilitychange', this.visibility);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.25);
    this.canvas.width = Math.max(1, Math.floor(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.h * this.dpr));
    this.canvas.style.width = `${this.w}px`; this.canvas.style.height = `${this.h}px`;
    if (!this.ctx) {
      // Decorative equation rain is optional; the main UI and CSS fallback must
      // still start when a browser cannot create a 2D canvas context.
      this.canvas.classList.add('rain-disabled');
      return;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.makeRain();
    this.zoneClock = 999;
  }

  makeRain() {
    const mobile = this.w < 680;
    const count = mobile ? 8 : 17;
    this.streams = Array.from({ length: count }, (_, i) => {
      const kind = i % 4 === 0 ? 'pi' : i % 3 === 0 ? 'formula' : 'symbol';
      return {
        x: rand(0, this.w), y: rand(-this.h, this.h), speed: rand(14, mobile ? 32 : 43),
        gap: rand(19, 29), size: rand(mobile ? 9 : 10, mobile ? 13 : 15),
        len: Math.floor(rand(5, 12)), kind, seed: Math.random() * 10000,
        drift: rand(-5, 5), phase: rand(0, Math.PI * 2), chars: [], tick: rand(0, .2), color: i % 3
      };
    });
    for (const stream of this.streams) {
      stream.chars = Array.from({ length: stream.len }, (_, j) => this.charFor(stream, j));
    }
    const n = mobile ? 5 : 9;
    this.formulaComets = Array.from({ length: n }, (_, i) => {
      const item = {
        text: FORMULAS[(i * 2 + Math.floor(Math.random() * FORMULAS.length)) % FORMULAS.length],
        x: 0, y: 0, vx: 0, vy: 0, angle: 0,
        size: rand(mobile ? 8 : 10, mobile ? 12 : 14),
        alpha: rand(.16, .26), wait: 0,
        color: i % 3, trail: rand(mobile ? 48 : 70, mobile ? 100 : 155)
      };
      this.launchFormulaComet(item, i / n);
      return item;
    });
  }

  launchFormulaComet(item, stagger = Math.random()) {
    const horizontal = Math.random() < 0.72;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const angle = rand(-0.46, 0.46);
    if (horizontal) {
      item.x = direction > 0 ? -this.w * 0.12 : this.w * 1.12;
      item.y = rand(this.h * 0.08, this.h * 0.92);
      item.vx = direction * Math.cos(angle) * rand(115, 205);
      item.vy = Math.sin(angle) * rand(85, 155);
    } else {
      item.x = rand(this.w * 0.12, this.w * 0.88);
      item.y = direction > 0 ? -this.h * 0.12 : this.h * 1.12;
      item.vx = Math.sin(angle) * rand(85, 150);
      item.vy = direction * Math.cos(angle) * rand(115, 205);
    }
    item.angle = Math.atan2(item.vy, item.vx);
    item.wait = stagger * 1.8;
  }

  charFor(stream, index) {
    if (stream.kind === 'pi') return DIGITS[Math.floor(Math.random() * DIGITS.length)];
    if (stream.kind === 'formula') { const formula = FORMULAS[Math.floor(Math.random() * FORMULAS.length)]; return formula[Math.floor(Math.random() * formula.length)] || '∑'; }
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  setPalette(palette) { if (palette?.length) this.palette = palette.slice(); }

  readZones() {
    const selectors = ['.corner', '.portal', '.identity', '.reveal'];
    const rects = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(el => {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.04) return;
        if (el.classList.contains('portal') && el.classList.contains('is-hidden')) return;
        if (el.classList.contains('reveal') && !el.classList.contains('is-visible')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const pad = el.classList.contains('reveal') ? 22 : el.classList.contains('portal') ? 15 : 8;
        rects.push({ left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad });
      });
    }
    if (document.body.dataset.phase !== 'idle') {
      rects.push({
        left: this.w * 0.08, right: this.w * 0.92,
        top: this.h * 0.22, bottom: this.h * 0.70
      });
    }
    this.zones = rects;
  }

  protected(x, y, span = 0) {
    return this.zones.some(r => x + span >= r.left && x <= r.right && y >= r.top - 12 && y <= r.bottom + 12);
  }

  burst() {
    const count = this.w < 680 ? 58 : 112;
    const cx = this.w * rand(0.4, 0.6), cy = this.h * rand(0.32, 0.51);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + rand(-0.03, 0.03);
      const speed = rand(45, 245) * (i % 9 === 0 ? 1.3 : 1);
      this.bursts.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: rand(0.85, 2.0), age: 0, size: rand(8, 16), glyph: i % 4 === 0 ? 'π' : SYMBOLS[(Math.random() * SYMBOLS.length) | 0],
        color: i % 3, rotation: rand(-1.0, 1.0), spin: rand(-2.0, 2.0), drag: rand(0.93, 0.98) });
    }
    if (this.bursts.length > 250) this.bursts.splice(0, this.bursts.length - 250);
    this.gsap.to(this, { energy: 1.0, duration: 0.22, ease: 'power2.out', overwrite: true,
      onComplete: () => this.gsap.to(this, { energy: 0.42, duration: 2.5, ease: 'sine.out' }) });
  }

  pulse(power = 0.7) {
    const count = Math.round(16 + clamp(power, 0, 1.5) * 34);
    const cx = this.w * 0.5, cy = this.h * 0.48;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), speed = rand(28, 145) * power;
      this.bursts.push({ x: cx, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: rand(.55, 1.2), age: 0, size: rand(8, 14), glyph: Math.random() > .45 ? 'π' : '∫',
        color: i % 3, rotation: 0, spin: rand(-1.8, 1.8), drag: .96 });
    }
  }

  frame(now) {
    this.raf = 0;
    if (this.hidden || !this.ctx) return;
    const dt = this.last ? Math.min(.04, Math.max(.001, (now - this.last) / 1000)) : .016;
    this.last = now;
    this.time += dt * (this.reducedMotion ? 0.35 : 1);
    this.zoneClock += dt;
    if (this.zoneClock > 0.28) { this.readZones(); this.zoneClock = 0; }
    const ctx = this.ctx;
    // Fade only existing glyph pixels; the canvas remains transparent and the true-black scene stays black.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${this.reducedMotion ? .13 : .075})`;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';
    this.drawStreams(ctx, dt);
    this.drawFormulaComets(ctx, dt);
    this.drawBursts(ctx, dt);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(this.frame);
  }

  drawStreams(ctx, dt) {
    for (const stream of this.streams) {
      stream.y += stream.speed * dt * (0.65 + this.energy * 0.65) * (this.reducedMotion ? .25 : 1);
      stream.x += (stream.drift + Math.sin(this.time * .4 + stream.phase) * 2) * dt;
      stream.tick += dt;
      if (stream.tick > (this.energy > .72 ? .11 : .19)) {
        stream.tick = 0;
        stream.chars.unshift(this.charFor(stream, 0));
        stream.chars.length = stream.len;
      }
      if (stream.y - stream.len * stream.gap > this.h + 20) { stream.y = rand(-this.h * .4, -35); stream.x = rand(0, this.w); }
      if (stream.x < -20) stream.x = this.w + 15;
      if (stream.x > this.w + 20) stream.x = -15;
      const color = this.palette[stream.color % this.palette.length];
      for (let j = 0; j < stream.len; j++) {
        const y = stream.y - j * stream.gap;
        const x = stream.x + Math.sin(this.time * .35 + stream.phase + j * .22) * 1.9;
        if (y < -24 || y > this.h + 24 || this.protected(x, y, stream.size * 1.2)) continue;
        const tail = Math.pow(1 - j / stream.len, 1.6);
        const alpha = tail * (stream.kind === 'formula' ? .11 : .16) * this.energy * (j === 0 ? 1.7 : 1);
        ctx.globalAlpha = clamp(alpha, 0, .32);
        ctx.fillStyle = color;
        ctx.font = `${j === 0 ? '500' : '400'} ${stream.size}px 'DM Mono', monospace`;
        ctx.shadowBlur = j === 0 ? 4 : 0;
        ctx.shadowColor = color;
        ctx.fillText(stream.chars[j] || '·', x, y);
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  drawFormulaComets(ctx, dt) {
    for (const item of this.formulaComets) {
      if (item.wait > 0) {
        item.wait = Math.max(0, item.wait - dt);
        continue;
      }
      const motionScale = this.reducedMotion ? .3 : 1;
      item.x += item.vx * dt * motionScale;
      item.y += item.vy * dt * motionScale;
      item.vy += 2.8 * dt * motionScale;
      item.angle = Math.atan2(item.vy, item.vx);
      const font = `600 ${item.size}px 'DM Mono', monospace`;
      ctx.font = font;
      const width = ctx.measureText(item.text).width;
      const margin = Math.max(width + item.trail, item.size * 5);
      if (item.x < -margin || item.x > this.w + margin || item.y < -margin || item.y > this.h + margin) {
        this.launchFormulaComet(item, Math.random() * .7);
        continue;
      }
      const textX = item.x - Math.cos(item.angle) * width;
      const textY = item.y - Math.sin(item.angle) * width;
      if (this.protected(textX, textY, width)) continue;
      const c = this.palette[item.color % this.palette.length];
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.angle);
      ctx.globalAlpha = item.alpha * (0.72 + this.energy * .12);
      const trail = ctx.createLinearGradient(-width - item.trail, 0, -width * .78, 0);
      trail.addColorStop(0, 'rgba(255,255,255,0)');
      trail.addColorStop(.65, c);
      trail.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = Math.max(1, item.size * .075);
      ctx.beginPath();
      ctx.moveTo(-width - item.trail, 0);
      ctx.lineTo(-width * .72, 0);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 2;
      ctx.fillText(item.text, -width - 12, item.size * .34);
      ctx.beginPath();
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 3;
      ctx.arc(0, 0, Math.max(1.5, item.size * .065), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawBursts(ctx, dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.age += dt;
      if (p.age >= p.life) { this.bursts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.drag; p.vy *= p.drag; p.rotation += p.spin * dt;
      if (this.protected(p.x, p.y, p.size)) continue;
      const k = 1 - p.age / p.life;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.globalAlpha = k * k * .7;
      ctx.fillStyle = this.palette[p.color % this.palette.length];
      ctx.font = `${p.size}px 'DM Mono', monospace`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 7;
      ctx.fillText(p.glyph, 0, 0); ctx.restore();
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
