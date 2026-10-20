import * as THREE from 'three';

const FONT_STACK = '"Nunito Sans", "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * The only text allowed on the shared-galaxy screen: the nine recipient names.
 * Each name is a camera-facing sprite rendered by the same WebGL renderer (after
 * the bloom pass, so glyph edges stay crisp) and sized in CSS pixels so it stays
 * readable at any galaxy depth.
 */
export class NameLabels {
  constructor(recipients) {
    this.recipients = recipients;
    this.scene = new THREE.Scene();
    this.entries = recipients.map(recipient => {
      const material = new THREE.SpriteMaterial({
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 1
      });
      const sprite = new THREE.Sprite(material);
      sprite.center.set(0.5, 1);
      sprite.renderOrder = 100;
      sprite.frustumCulled = false;
      this.scene.add(sprite);
      return { recipient, sprite, material, cssW: 80, cssH: 24, rect: { x: 0, y: 0, hw: 40, hh: 12 } };
    });
    this.mobile = false;
    this.dpr = 1;
    this.fontSize = 12;
    this.ready = false;
  }

  rebuild({ mobile, dpr }) {
    this.mobile = mobile;
    this.dpr = dpr;
    this.fontSize = mobile ? 11 : 12;
    const scale = Math.ceil(Math.min(3, Math.max(2, dpr)));
    for (const entry of this.entries) {
      const label = entry.recipient.display || entry.recipient.name;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const font = `600 ${this.fontSize * scale}px ${FONT_STACK}`;
      ctx.font = font;
      try { ctx.letterSpacing = `${0.025 * this.fontSize * scale}px`; } catch { /* optional */ }
      const textWidth = Math.ceil(ctx.measureText(label).width);
      const padX = 5 * scale, padY = 4 * scale;
      canvas.width = textWidth + padX * 2;
      canvas.height = Math.ceil(this.fontSize * scale * 1.55) + padY * 2;
      // Resizing the canvas resets the context state.
      ctx.font = font;
      try { ctx.letterSpacing = `${0.025 * this.fontSize * scale}px`; } catch { /* optional */ }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = canvas.width / 2;
      const y = canvas.height / 2;
      const [primary = '#b9acc5'] = entry.recipient.palette || [];
      ctx.shadowColor = primary;
      ctx.shadowBlur = 1.2 * scale;
      ctx.fillStyle = '#f4edf1';
      ctx.fillText(label, x, y);
      ctx.shadowBlur = 0;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.anisotropy = 4;
      entry.material.map?.dispose();
      entry.material.map = texture;
      entry.material.needsUpdate = true;
      entry.cssW = canvas.width / scale;
      entry.cssH = canvas.height / scale;
    }
    this.ready = true;
  }

  /** Position/size every label from the galaxies' projected centres. */
  update(galaxies, viewW, viewH, hoverIndex, hidden = false) {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = galaxies[i] && this.entries[i];
      if (!entry) continue;
      const g = galaxies[i];
      const wpp = g.screen.worldPerPixel || 0.05;
      const gap = g.screen.radius * 0.62 + (this.mobile ? 2 : 4);
      entry.sprite.visible = !hidden && g.screen.visible;
      entry.sprite.position.set(g.center.x, g.center.y - gap * wpp, g.center.z + 0.4);
      entry.sprite.scale.set(entry.cssW * wpp, entry.cssH * wpp, 1);
      entry.material.opacity = 0.98 + 0.02 * g.hover;
      // Screen-space rectangle of the visible text (for picking).
      const top = g.screen.y * viewH + gap;
      entry.rect.x = g.screen.x * viewW;
      entry.rect.y = top + entry.cssH * 0.5;
      entry.rect.hw = entry.cssW * 0.5;
      entry.rect.hh = entry.cssH * 0.5;
    }
  }

  hit(px, py) {
    for (let i = 0; i < this.entries.length; i++) {
      const r = this.entries[i].rect;
      if (Math.abs(px - r.x) <= r.hw + 4 && Math.abs(py - r.y) <= r.hh + 4) return i;
    }
    return -1;
  }

  dispose() {
    for (const entry of this.entries) {
      entry.material.map?.dispose();
      entry.material.dispose();
      this.scene.remove(entry.sprite);
    }
    this.entries.length = 0;
  }
}
