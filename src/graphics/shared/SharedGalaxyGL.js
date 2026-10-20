import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES } from '../../data/galaxyProfiles.js';
import { recipientArtDirections } from '../../data/artDirections.js';
import { createStarField } from '../SpaceField.js';
import { GalaxyCluster } from './GalaxyCluster.js';
import { MatterBridges } from './MatterBridges.js';
import { SharedComet } from './SharedComet.js';
import { IntergalacticField } from './IntergalacticField.js';
import { SwipeHint } from './SwipeHint.js';
import { NameLabels } from './NameLabels.js';
import { SharedEventDirector } from './SharedEventDirector.js';
import { CosmicEventScheduler, EVENT_KINDS, mulberry32 } from './CosmicEventScheduler.js';
import { SHARED_CAMERA, computeLayout, buildBridgeGraph, halfExtentsAt } from './layout.js';
import { veilFragmentShader, galaxyNebulaVertexShader } from './sharedShaders.js';

const BACKGROUND = '#070813';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * The shared sky: nine galaxies, intergalactic matter bridges, dust veils, depth
 * layers, a wish comet and stateful cosmic events — all in ONE WebGL renderer and
 * ONE requestAnimationFrame loop. It reuses the personal-universe galaxy generator
 * and GPU shader (GalaxyArchitecture), the comet ribbon shaders (CometField), the
 * star-field LODs (SpaceField) and the nebula noise (shaders.js).
 */
export class SharedGalaxyGL {
  constructor({ canvas, view, recipients, wishes, onSelect, seed }) {
    if (!canvas) throw new Error('Shared galaxy canvas is missing');
    // Create the renderer first: if WebGL is unavailable this throws before any DOM
    // is touched and SharedGalaxy falls back to the Canvas 2D implementation.
    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    if (!this.renderer.getContext()) throw new Error('WebGL context unavailable');

    this.canvas = canvas;
    this.view = view;
    this.recipients = recipients;
    this.wishes = wishes;            // retained data; never drawn on the shared screen
    this.onSelect = onSelect;
    this.active = false;
    this.disposed = false;
    this.raf = 0;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.seed = seed === undefined ? (Date.now() ^ 0x5bd1e995) >>> 0 : seed >>> 0;
    this.renderedFrames = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.mobile = matchMedia('(max-width: 680px)').matches || matchMedia('(pointer: coarse)').matches;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionScale = this.reducedMotion ? 0.22 : 1;
    this.hoverIndex = -1;
    this.pointer = { x: -1000, y: -1000, nx: 0, ny: 0 };
    this.hoverRaycaster = new THREE.Raycaster();
    this.hoverPlane = new THREE.Plane();
    this.hoverPlaneNormal = new THREE.Vector3();
    this.hoverNdc = new THREE.Vector2();
    this.hoverPoint = new THREE.Vector3();
    this.hoverLocalPoint = new THREE.Vector3();
    this.lastHoverPulseIndex = -1;
    this.lastHoverPulseAt = -Infinity;
    this.mobilePan = { x: 0, y: 0 };
    this.gesture = null;
    this.parallax = { x: 0, y: 0 };
    this.adaptive = true;
    this.quality = { level: 0, bloom: true, dprCap: this.mobile ? 1.25 : 1.75 };
    this.frameTimes = new Float32Array(90);
    this.frameTimeCursor = 0;
    this.frameTimeCount = 0;
    this.measuredFps = 0;
    this.lastEventLog = [];

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(BACKGROUND, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(SHARED_CAMERA.fov, 1.6, SHARED_CAMERA.near, SHARED_CAMERA.far);
    this.camera.position.set(0, 0, SHARED_CAMERA.z);

    const profileFor = recipient => GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[recipient.id]] || GALAXY_PROFILES.twinSpiral;
    const particleCount = this.mobile ? 3200 : 6200;
    this.galaxies = recipients.map((recipient, index) => new GalaxyCluster({
      index, recipient, profile: profileFor(recipient),
      direction: recipientArtDirections[recipient.id] || null,
      count: particleCount, pixelRatio: 1, mobile: this.mobile
    }));
    for (const galaxy of this.galaxies) this.scene.add(galaxy.root);

    this.stars = createStarField(this.scene, 1, this.mobile, mulberry32(this.seed ^ 0x85ebca6b));
    this.stars.layers[0].points.scale.setScalar(2.3);
    this.stars.layers[1].points.scale.setScalar(1.9);
    this.foreground = this.stars.layers[2];
    this.foreground.points.position.z = 22;
    this.foreground.points.renderOrder = 70;
    this.intergalacticField = new IntergalacticField(this.scene, {
      mobile: this.mobile, rng: mulberry32(this.seed ^ 0xc2b2ae35)
    });

    this.bridges = new MatterBridges(this.scene, { pixelRatio: 1, mobile: this.mobile });
    this.comet = new SharedComet(this.scene, { pixelRatio: 1, mobile: this.mobile, seed: this.seed ^ 0x9e3779b9 });
    this.veils = this.makeVeils();
    this.labels = new NameLabels(recipients);
    this.swipeHint = new SwipeHint();

    this.edges = [];
    this.layout = [];
    this.scheduler = new CosmicEventScheduler({
      rng: mulberry32(this.seed), galaxyCount: recipients.length
    });
    this.director = new SharedEventDirector({
      galaxies: this.galaxies, bridges: this.bridges, comet: this.comet,
      getEdges: () => this.edges,
      getFrustum: z => halfExtentsAt(z, this.camera.aspect)
    });

    this.composer = null;
    this.bloomPass = null;
    this.buildComposer();

    this.accessibleNodeGroup = document.querySelector('#sharedGalaxyAccessibleNodes');
    this.accessibleBindings = [];
    if (this.accessibleNodeGroup) {
      for (const recipient of recipients) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shared-galaxy-accessible-node';
        button.textContent = recipient.display || recipient.name;
        button.setAttribute('aria-label', `Mở vũ trụ của ${recipient.name}`);
        const activate = () => this.select(recipient);
        button.addEventListener('click', activate);
        this.accessibleNodeGroup.append(button);
        this.accessibleBindings.push([button, activate]);
      }
    }

    this.boundResize = () => this.resize();
    this.boundMove = event => this.onPointerMove(event);
    this.boundLeave = () => { this.pointer.x = this.pointer.y = -1000; this.hoverIndex = -1; };
    this.boundDown = event => this.onPointerDown(event);
    this.boundUp = event => this.onPointerUp(event);
    this.boundVisibility = () => this.onVisibilityChange();
    this.boundFrame = time => this.frame(time);
    this.boundMotion = () => {
      this.reducedMotion = this.motionQuery.matches;
      this.motionScale = this.reducedMotion ? 0.22 : 1;
      this.foreground.points.visible = !this.reducedMotion;
    };
    this.boundContextLost = event => { event.preventDefault(); };
    canvas.addEventListener('pointermove', this.boundMove, { passive: false });
    canvas.addEventListener('pointerleave', this.boundLeave, { passive: true });
    canvas.addEventListener('pointerdown', this.boundDown, { passive: false });
    canvas.addEventListener('pointerup', this.boundUp);
    canvas.addEventListener('pointercancel', this.boundUp);
    canvas.addEventListener('webglcontextlost', this.boundContextLost);
    window.addEventListener('resize', this.boundResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.motionQuery.addEventListener?.('change', this.boundMotion);

    this.boundMotion();
    this.resize();
    // Labels use the webfont when it arrives; rebuild once so glyph metrics match.
    document.fonts?.ready?.then(() => { if (!this.disposed) this.labels.rebuild({ mobile: this.mobile, dpr: this.dpr }); }).catch(() => {});
  }

  /* ------------------------------------------------------------ construction */
  makeVeils() {
    const defs = [
      { nx: -0.38, ny: -0.30, z: -6, w: 1.55, h: 0.80, alpha: 0.20, seed: 0.21, rank: 2, rim: '#8f7fb8' },
      { nx: 0.46, ny: 0.30, z: -1, w: 1.35, h: 0.72, alpha: 0.17, seed: 0.63, rank: 5, rim: '#b58aa6' },
      { nx: -0.50, ny: 0.62, z: 13, w: 1.10, h: 0.55, alpha: 0.11, seed: 0.87, rank: 9, rim: '#7f9ab8' }
    ];
    const geometry = new THREE.PlaneGeometry(2, 2);
    return defs.map(def => {
      const uniforms = {
        uTime: { value: 0 }, uSeed: { value: def.seed }, uAlpha: { value: def.alpha },
        uOctaves: { value: this.mobile ? 3 : 4 },
        uBody: { value: new THREE.Color('#05060f') }, uRim: { value: new THREE.Color(def.rim) }
      };
      const material = new THREE.ShaderMaterial({
        uniforms, vertexShader: galaxyNebulaVertexShader, fragmentShader: veilFragmentShader,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        toneMapped: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return { def, uniforms, material, mesh, drift: def.seed * 6.28 };
    });
  }

  buildComposer() {
    this.composer?.dispose?.();
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), this.mobile ? 0.15 : 0.20, 0.34, this.mobile ? 0.66 : 0.62);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  /* ------------------------------------------------------------------ layout */
  resize() {
    if (this.disposed) return;
    const rect = this.view?.getBoundingClientRect?.() || { width: innerWidth, height: innerHeight };
    this.width = Math.max(1, rect.width || innerWidth);
    this.height = Math.max(1, rect.height || innerHeight);
    this.mobile = this.width < 680 || matchMedia('(pointer: coarse)').matches;
    this.applyPixelRatio();
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.intergalacticField.setViewport(this.camera, this.dpr);
    this.applyLayout();
    this.labels.rebuild({ mobile: this.mobile, dpr: this.dpr });
    if (this.active && this.reducedMotion) this.render();
  }

  applyPixelRatio() {
    const dpr = Math.min(this.quality.dprCap, window.devicePixelRatio || 1);
    const changed = Math.abs(dpr - this.dpr) > 1e-3;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(dpr * (this.mobile ? 0.75 : 0.85));
    this.composer.setSize(this.width, this.height);
    for (const galaxy of this.galaxies) galaxy.setPixelRatio(dpr);
    for (const layer of this.stars.layers) layer.uniforms.uPixelRatio.value = dpr;
    this.intergalacticField.setViewport(this.camera, dpr);
    this.bridges.setPixelRatio(dpr);
    this.comet.setPixelRatio(dpr);
    return changed;
  }

  applyLayout() {
    const aspect = this.camera.aspect;
    this.layout = computeLayout({ aspect, mobile: this.mobile });
    if (!this.mobile) this.mobilePan.x = this.mobilePan.y = 0;
    this.mobilePan.x = clamp(this.mobilePan.x, 0, Math.max(0, ...this.layout.map(slot => slot.x)));
    this.mobilePan.y = clamp(this.mobilePan.y, Math.min(0, ...this.layout.map(slot => slot.y)), 0);
    this.edges = buildBridgeGraph(this.layout, aspect);
    // Depth-sort so far galaxies are drawn first; veils slot in between ranks.
    const order = this.galaxies.map((g, i) => i).sort((a, b) => this.layout[a].z - this.layout[b].z);
    order.forEach((index, rank) => this.galaxies[index].setLayout(this.layout[index], 10 + rank * 4));
    this.galaxies.forEach(g => g.root.updateMatrixWorld(true));
    this.bridges.configure(this.edges, this.galaxies, 6);
    for (const veil of this.veils) {
      const { halfW, halfH } = halfExtentsAt(veil.def.z, this.camera.aspect);
      veil.mesh.position.set(veil.def.nx * halfW, veil.def.ny * halfH, veil.def.z);
      veil.mesh.scale.set(halfH * veil.def.w * Math.max(1, this.camera.aspect * 0.75), halfH * veil.def.h, 1);
      veil.mesh.renderOrder = 10 + veil.def.rank * 4 - 1;
      veil.base = veil.mesh.position.clone();
    }
  }

  /* ------------------------------------------------------------------ control */
  start({ focusIndex = 0 } = {}) {
    if (this.disposed || this.active) return;
    this.active = true;
    this.lastFrame = 0;
    this.scheduler.reset(this.elapsed);
    const focus = this.mobile ? this.layout[focusIndex] : null;
    this.mobilePan.x = focus?.x || 0;
    this.mobilePan.y = focus?.y || 0;
    this.swipeHint.show(this.mobile);
    this.view?.classList.add('is-active');
    this.view?.setAttribute('aria-hidden', 'false');
    this.resize();
    this.frame(performance.now());
  }

  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastFrame = 0;
    this.gesture = null;
    this.swipeHint.hide();
    this.director.end(this.elapsed);
    this.comet.stop();
    this.view?.classList.remove('is-active');
    this.view?.setAttribute('aria-hidden', 'true');
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

  select(recipient) {
    const index = this.recipients.indexOf(recipient);
    if (index >= 0) { this.galaxies[index].pulseCore(1.4); this.galaxies[index].setFlare(0, 0, 2.5); }
    this.onSelect?.(recipient);
  }

  /* -------------------------------------------------------------------- loop */
  frame(now) {
    if (!this.active || this.disposed || document.hidden) { this.raf = 0; return; }
    const rawDt = this.lastFrame ? (now - this.lastFrame) / 1000 : 0;
    this.lastFrame = now;
    this.trackFrameTime(rawDt);
    const dt = clamp(rawDt, 0, 0.07) * this.motionScale;
    this.advance(dt);
    this.render();
    this.renderedFrames++;
    this.raf = requestAnimationFrame(this.boundFrame);
  }

  /** Simulation step with no drawing (also used by tests to fast-forward). */
  advance(dt) {
    this.elapsed += dt;
    const t = this.elapsed;
    this.updateCamera(t, dt);

    const events = this.scheduler.update(t, { enabled: !this.reducedMotion });
    if (events.finished) { this.director.end(t); this.logEvent('end', events.finished); }
    if (events.started) { this.director.begin(events.started, t); this.logEvent('start', events.started); }
    this.director.tick(t, dt);

    const cometAlive = this.comet.update(dt, this.galaxies);
    if (this.comet.reactions.length) {
      for (const index of this.comet.reactions) {
        const galaxy = this.galaxies[index];
        galaxy.pulse(this.comet.head, this.comet.kind === 'stream' ? 0.8 : 1.0);
        galaxy.novaBoost = Math.max(galaxy.novaBoost, 0.8);
        galaxy.setFlare(0, 0, 0);
      }
    }
    void cometAlive;

    this.hoverIndex = this.pointer.x > -500 ? this.pick(this.pointer.x, this.pointer.y) : -1;
    if (this.hoverIndex < 0) {
      this.lastHoverPulseIndex = -1;
    } else if (this.hoverIndex !== this.lastHoverPulseIndex || t - this.lastHoverPulseAt >= 1.4) {
      this.triggerHoverPulse(this.hoverIndex);
      this.lastHoverPulseIndex = this.hoverIndex;
      this.lastHoverPulseAt = t;
    }
    for (let i = 0; i < this.galaxies.length; i++) {
      this.galaxies[i].update(t, dt, i === this.hoverIndex ? 1 : 0, this.camera, this.height);
    }
    this.bridges.update(t, t);
    for (const layer of this.stars.layers) layer.uniforms.uTime.value = t;
    this.intergalacticField.setTime(t);
    for (const veil of this.veils) {
      veil.uniforms.uTime.value = t;
      const d = veil.drift;
      veil.mesh.position.x = veil.base.x + Math.sin(t * 0.021 + d) * 1.4;
      veil.mesh.position.y = veil.base.y + Math.cos(t * 0.017 + d * 1.3) * 0.8;
    }
    this.labels.update(this.galaxies, this.width, this.height, this.hoverIndex, false);
  }

  /** Slow, deliberate camera: no shake, no random zoom; amplitude is a few percent. */
  updateCamera(t, dt) {
    const follow = 1 - Math.exp(-dt * 2.2);
    this.parallax.x += (this.pointer.nx - this.parallax.x) * follow;
    this.parallax.y += (this.pointer.ny - this.parallax.y) * follow;
    const mobileScale = this.mobile ? 0 : 1;
    const x = (1.7 * Math.sin(t * 0.043) + 0.7 * Math.sin(t * 0.11 + 1.3)) * mobileScale
      + this.parallax.x * (this.mobile ? 0 : 0.9);
    const y = (0.95 * Math.sin(t * 0.031 + 0.8) + 0.35 * Math.sin(t * 0.087)) * mobileScale
      - this.parallax.y * (this.mobile ? 0 : 0.55);
    const z = SHARED_CAMERA.z + 1.6 * Math.sin(t * 0.027 + 0.4);
    const cameraX = x + this.mobilePan.x;
    const cameraY = y + this.mobilePan.y;
    this.camera.position.set(cameraX, cameraY, z);
    this.camera.lookAt(
      this.mobile ? cameraX : x * 0.25,
      this.mobile ? cameraY : y * 0.25,
      -6
    );
    this.camera.updateMatrixWorld();
  }

  render() {
    this.renderer.info.reset();
    if (this.quality.bloom && this.composer) {
      this.composer.render();
    } else {
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
    }
    if (this.labels.ready) {
      this.renderer.clearDepth();
      this.renderer.render(this.labels.scene, this.camera);
    }
  }

  /* ----------------------------------------------------------- adaptive load */
  trackFrameTime(rawDt) {
    if (!rawDt || rawDt > 1.5) return;
    this.frameTimes[this.frameTimeCursor] = rawDt;
    this.frameTimeCursor = (this.frameTimeCursor + 1) % this.frameTimes.length;
    this.frameTimeCount = Math.min(this.frameTimes.length, this.frameTimeCount + 1);
    if (this.frameTimeCount < this.frameTimes.length || this.frameTimeCursor !== 0) return;
    let sum = 0;
    for (let i = 0; i < this.frameTimes.length; i++) sum += this.frameTimes[i];
    const mean = sum / this.frameTimes.length;
    this.measuredFps = 1 / mean;
    if (!this.adaptive || this.reducedMotion) return;
    if (mean > 1 / 34 && this.quality.level < 3) this.degrade();
  }

  degrade() {
    this.quality.level++;
    if (this.quality.level === 1) {
      this.quality.dprCap = Math.max(1, this.quality.dprCap - 0.5);
      this.applyPixelRatio();
    } else if (this.quality.level === 2) {
      for (const galaxy of this.galaxies) galaxy.setNebulaOctaves(2);
      for (const veil of this.veils) veil.uniforms.uOctaves.value = 2;
    } else {
      this.quality.bloom = false;
    }
  }

  /* ------------------------------------------------------------------- input */
  pick(x, y) {
    const labelHit = this.labels.hit(x, y);
    if (labelHit >= 0) return labelHit;
    const minPx = this.mobile ? 30 : 36;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.galaxies.length; i++) {
      const s = this.galaxies[i].screen;
      if (!s.visible) continue;
      const dx = s.x * this.width - x;
      const dy = s.y * this.height - y;
      const radius = Math.max(s.radius * 0.9, minPx);
      const d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius) {
        // Prefer the nearest-to-camera galaxy when disks overlap on screen.
        const score = s.distance + Math.sqrt(d2) * 0.01;
        if (score < bestScore) { bestScore = score; best = i; }
      }
    }
    return best;
  }

  triggerHoverPulse(index) {
    const galaxy = this.galaxies[index];
    galaxy.root.updateMatrixWorld(true);
    this.hoverNdc.set(this.pointer.nx, this.pointer.ny);
    this.hoverRaycaster.setFromCamera(this.hoverNdc, this.camera);
    this.hoverPlaneNormal.set(0, 0, 1).transformDirection(galaxy.root.matrixWorld);
    this.hoverPlane.setFromNormalAndCoplanarPoint(this.hoverPlaneNormal, galaxy.center);
    const intersection = this.hoverRaycaster.ray.intersectPlane(this.hoverPlane, this.hoverPoint);
    if (intersection) {
      this.hoverLocalPoint.copy(intersection);
      galaxy.root.worldToLocal(this.hoverLocalPoint);
    } else {
      this.hoverLocalPoint.set(0, 0, 0);
    }

    const offset = this.hoverLocalPoint;
    const radius = Math.hypot(offset.x, offset.y);
    if (radius < 1.15) {
      offset.x += Math.cos(galaxy.phase) * (1.15 - radius);
      offset.y += Math.sin(galaxy.phase) * (1.15 - radius);
    } else if (radius > 3.5) {
      offset.multiplyScalar(3.5 / radius);
    }
    offset.z = 0;
    galaxy.root.localToWorld(offset);
    galaxy.pulse(offset, 2.2);
    galaxy.novaBoost = Math.max(galaxy.novaBoost, 0.85);
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
        const worldPerPixel = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
          * this.camera.position.z / this.height * 1.3;
        this.mobilePan.x = clamp(this.mobilePan.x - dx * worldPerPixel, 0, Math.max(0, ...this.layout.map(slot => slot.x)));
        this.mobilePan.y = clamp(this.mobilePan.y + dy * worldPerPixel, Math.min(0, ...this.layout.map(slot => slot.y)), 0);
        event.preventDefault();
      }
      return;
    }
    if (event.pointerType === 'touch') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.nx = (this.pointer.x / this.width) * 2 - 1;
    this.pointer.ny = (this.pointer.y / this.height) * 2 - 1;
    this.canvas.style.cursor = this.pick(this.pointer.x, this.pointer.y) >= 0 ? 'pointer' : 'crosshair';
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
    const index = this.pick(x, y);
    if (index >= 0) {
      event.preventDefault();
      this.select(this.recipients[index]);
      return;
    }
    // Touching empty sky nudges the nearest galaxy (radial pulse + a bridge wave).
    let nearest = -1, nearestD = Infinity;
    for (let i = 0; i < this.galaxies.length; i++) {
      const s = this.galaxies[i].screen;
      const d = Math.hypot(s.x * this.width - x, s.y * this.height - y);
      if (d < nearestD) { nearestD = d; nearest = i; }
    }
    if (nearest >= 0) {
      const galaxy = this.galaxies[nearest];
      galaxy.pulseCore(0.8);
      this.edges.forEach(([a, b], edge) => {
        if (a === nearest || b === nearest) this.bridges.sendPulse(edge, nearest, this.elapsed, 1.4, 0.7);
      });
    }
  }

  /** Start a specific event immediately (verification and manual direction). */
  triggerEvent(kind, galaxy = 0) {
    const spec = EVENT_KINDS[kind];
    if (!spec) return null;
    this.director.end(this.elapsed);
    const event = {
      id: ++this.scheduler.counter, kind, start: this.elapsed,
      duration: (spec.min + spec.max) / 2, galaxy: galaxy % this.galaxies.length,
      seed: (Math.imul(this.scheduler.counter, 2654435761) >>> 0) || 1
    };
    this.scheduler.current = event;
    this.scheduler.lastKind = kind;
    this.scheduler.history.push({ id: event.id, kind, galaxy: event.galaxy, start: event.start, duration: event.duration });
    this.director.begin(event, this.elapsed);
    this.logEvent('start', event);
    return event;
  }

  /* -------------------------------------------------------------- diagnostics */
  logEvent(type, event) {
    this.lastEventLog.push({ type, id: event.id, kind: event.kind, galaxy: event.galaxy, at: +this.elapsed.toFixed(2), duration: +event.duration.toFixed(2) });
    if (this.lastEventLog.length > 80) this.lastEventLog.shift();
  }

  getDiagnostics() {
    const info = this.renderer.info;
    return {
      renderer: 'three-webgl', frames: this.renderedFrames, elapsed: this.elapsed,
      fps: this.measuredFps, quality: { ...this.quality }, dpr: this.dpr,
      frameTimeMs: this.measuredFps ? 1000 / this.measuredFps : 0,
      activeEvent: this.scheduler.current ? { ...this.scheduler.current } : null,
      cometActive: this.comet.active, cometKind: this.comet.kind,
      intergalacticParticles: this.intergalacticField.count,
      bridgePulses: this.bridges.activePulseCount, edges: this.edges.length,
      drawCalls: info.render.calls, points: info.render.points, triangles: info.render.triangles,
      galaxies: this.galaxies.map((g, i) => ({
        id: this.recipients[i].id, uTime: g.uniforms.uTime.value, nova: g.uniforms.uNova.value,
        flare: g.uniforms.uFlare.value.z, x: g.screen.x * this.width, y: g.screen.y * this.height, r: g.screen.radius
      })),
      history: this.scheduler.history.slice(-12),
      labels: this.labels.entries.map(e => ({ text: e.recipient.display, x: e.rect.x, y: e.rect.y, hw: e.rect.hw, hh: e.rect.hh }))
    };
  }

  /* ----------------------------------------------------------------- cleanup */
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    const canvas = this.canvas;
    canvas.removeEventListener('pointermove', this.boundMove);
    canvas.removeEventListener('pointerleave', this.boundLeave);
    canvas.removeEventListener('pointerdown', this.boundDown);
    canvas.removeEventListener('pointerup', this.boundUp);
    canvas.removeEventListener('pointercancel', this.boundUp);
    canvas.removeEventListener('webglcontextlost', this.boundContextLost);
    window.removeEventListener('resize', this.boundResize);
    window.visualViewport?.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.motionQuery.removeEventListener?.('change', this.boundMotion);
    for (const [button, activate] of this.accessibleBindings) button.removeEventListener('click', activate);
    this.accessibleBindings.length = 0;
    this.accessibleNodeGroup?.replaceChildren();
    this.director.dispose();
    this.galaxies.forEach(g => g.dispose());
    this.bridges.dispose();
    this.comet.dispose();
    this.intergalacticField.dispose();
    this.labels.dispose();
    for (const veil of this.veils) { veil.material.dispose(); }
    this.veils[0]?.mesh.geometry.dispose();
    for (const layer of this.stars.layers) { layer.geometry.dispose(); layer.material.dispose(); }
    this.composer?.dispose?.();
    this.renderer.dispose();
  }
}
