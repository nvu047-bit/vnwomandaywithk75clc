import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ParticleCloud } from './ParticleCloud.js';
import { GalaxyArchitecture } from './GalaxyArchitecture.js';
import { CosmicEventLayer } from './CosmicEventLayer.js';
import { NebulaFlow } from './NebulaFlow.js';
import { CosmicBodies } from './CosmicBodies.js';
import { CometField } from './CometField.js';
import { StrangeAttractor } from './StrangeAttractor.js';
import { MathematicalCurves } from './MathematicalCurves.js';
import {
  createStarField, createNebulaVolume, setVolumePalette,
  setVolumeArtDirection, setVolumeTitleProtection, pulseNebulaVolume
} from './SpaceField.js';
import { getRecipientArtDirection } from '../data/artDirections.js';
import { GALAXY_PROFILES } from '../data/galaxyProfiles.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';

const DEFAULT_PALETTE = [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.periwinkle, COSMIC_COLORS.champagne];

function makeCoreTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(221,213,212,.92)');
  gradient.addColorStop(0.08, 'rgba(221,213,212,.78)');
  gradient.addColorStop(0.22, 'rgba(185,164,133,.34)');
  gradient.addColorStop(0.52, 'rgba(155,145,174,.13)');
  gradient.addColorStop(1, 'rgba(17,18,30,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class StellarScene {
  constructor(canvas, { onPhase = () => {}, onBurst = () => {}, onError = () => {} } = {}) {
    this.canvas = canvas;
    this.disposed = false;
    this.paused = false;
    this.resizeRaf = 0;
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.titleProtectionNodes = {
      reveal: document.querySelector('#reveal'),
      portal: document.querySelector('#portal')
    };
    this.nextTitleProtectionUpdate = 0;
    this.onPhase = onPhase;
    this.onBurst = onBurst;
    this.onError = onError;
    try {
    this.mobile = matchMedia('(pointer: coarse)').matches || this.width < 720 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    this.maxPixelRatio = this.mobile ? 1 : 1.35;
    this.pixelRatio = Math.min(devicePixelRatio || 1, this.maxPixelRatio);
    this.palette = DEFAULT_PALETTE.slice();
    this.elapsed = 0;
    this.lastFrame = 0;
    this.hidden = document.hidden;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tickerActive = false;
    this.frameCount = 0;
    this.qualityClock = 0;
    this.lowFpsWindows = 0;
    this.highFpsWindows = 0;
    this.degraded = false;
    this.pointerParallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.deviceParallaxEnabled = false;
    this.deviceParallaxPending = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: false, antialias: !this.mobile, depth: true,
      stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setClearColor(COSMIC_COLORS.space, 1);
    this._clearColor = new THREE.Color(COSMIC_COLORS.space);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Keep the volumetric nebula and emissive particles in a restrained HDR range.
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COSMIC_COLORS.space);
    this.identityScene = new THREE.Scene();
    this.nebulaScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(43, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 12.6);
    this.camera.lookAt(0, 0, 0);

    this.nebula = createNebulaVolume(this.nebulaScene, { mobile: this.mobile, palette: this.palette });
    this.createNebulaPass();
    this.stars = createStarField(this.scene, this.pixelRatio, this.mobile);
    this.galaxy = new GalaxyArchitecture(this.scene, { pixelRatio: this.pixelRatio, mobile: this.mobile });
    this.galaxy.setViewport(this.width, this.height, this.camera.position.z, this.camera.fov);
    this.cosmicEventLayer = new CosmicEventLayer(this.scene, { mobile: this.mobile, pixelRatio: this.pixelRatio });
    this.cosmicEventLayer.setViewport(this.width, this.height, this.camera.position.z, this.camera.fov);
    // Enough samples for names to retain a continuous, extra-bold silhouette at
    // desktop scale; the shader performs all motion on the GPU.
    this.particles = new ParticleCloud(this.identityScene, { pixelRatio: this.pixelRatio, count: this.mobile ? 6500 : 15000 });
    this.nebulaFlow = new NebulaFlow(this.scene, { mobile: this.mobile, pixelRatio: this.pixelRatio });
    setVolumeTitleProtection(this.nebula, this.particles.signatureBounds, this.particles.viewportScale);
    this.nebulaFlow.setTitleBounds(this.particles.signatureBounds, this.particles.viewportScale);
    this.bodies = new CosmicBodies(this.scene);
    this.comets = new CometField(this.scene, {
      pixelRatio: this.pixelRatio, mobile: this.mobile, palette: this.palette,
      width: this.width, height: this.height, cameraZ: this.camera.position.z, fov: this.camera.fov
    });
    this.attractor = new StrangeAttractor(this.scene);
    this.mathCurves = new MathematicalCurves(this.scene, {
      mobile: this.mobile, pixelRatio: this.pixelRatio,
      width: this.width, height: this.height
    });
    this.createCoreAndShockwaves();
    this.setPalette(this.palette);
    this.setupPostProcessing();
    this.particles.startIdleMorph(gsap);
    this.galaxy.startGatewayMorphing(gsap, this.reducedMotion);
    this.updateGalaxyTitleProtection();

    this.boundTick = this.tick.bind(this);
    // Resize events can fire in bursts while mobile browser chrome animates.
    // Coalesce them into one animation frame so renderer/composer targets are
    // resized once, with matching camera aspect and post-processing dimensions.
    this.boundResize = () => this.queueResize();
    this.boundVisibility = this.onVisibility.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerLeave = this.onPointerLeave.bind(this);
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundDeviceOrientation = this.onDeviceOrientation.bind(this);
    window.addEventListener('resize', this.boundResize, { passive: true });
    window.addEventListener('orientationchange', this.boundResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);
    // Keep the pointer listeners stable across rotation; the handler ignores
    // mouse input on touch-first devices rather than adding/removing listeners.
    window.addEventListener('pointermove', this.boundPointerMove, { passive: true });
    window.addEventListener('pointerleave', this.boundPointerLeave, { passive: true });
    window.addEventListener('pointerdown', this.boundPointerDown, { passive: true });
    if (!this.hidden) {
      gsap.ticker.add(this.boundTick);
      this.tickerActive = true;
    }
    this.boundContextLost = event => {
      event.preventDefault();
      this.onError(new Error('WebGL context lost'));
    };
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost);
    } catch (error) {
      // A constructor failure must release anything initialized before the error.
      this.dispose();
      throw error;
    }
  }

  queueResize() {
    if (this.disposed || this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.resize();
    });
  }

  createNebulaPass() {
    // The nebula is intentionally raymarched into a low-resolution target;
    // its soft volumetric edges upscale well and keep mobile fragment cost bounded.
    const scale = this.mobile ? 0.24 : 0.40;
    const width = Math.max(80, Math.floor(this.width * scale));
    const height = Math.max(80, Math.floor(this.height * scale));
    this.nebulaScale = scale;
    this.nebulaTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
    });
    this.nebulaTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: this.nebulaTarget.texture, transparent: true, opacity: 1,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: true
    });
    this.nebulaBackground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.nebulaBackground.frustumCulled = false;
    this.nebulaBackground.renderOrder = -100;
    this.scene.add(this.nebulaBackground);
    this.positionNebulaBillboard();
  }

  setupPostProcessing() {
    // Render once, bloom the luminous pixels, then perform the final color-space
    // conversion. Reduced composer pixel ratio keeps the mobile GPU budget sane.
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    // A restrained threshold lets particle halos bloom while preserving nebula folds.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      this.mobile ? 0.07 : 0.11,
      0.32,
      this.mobile ? 0.90 : 0.89
    );
    this.bloomPass.strength *= 1.45;
    this.bloomPass.radius = 0.18;
    this.outputPass = new OutputPass();
    this.identityPass = new RenderPass(this.identityScene, this.camera);
    this.identityPass.clear = false;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.identityPass);
    this.composer.addPass(this.outputPass);
    this.composer.setPixelRatio(this.composerPixelRatio());
    this.composer.setSize(this.width, this.height);
  }

  composerPixelRatio() {
    const budget = this.mobile
      ? (this.degraded ? 0.58 : 0.78)
      : (this.degraded ? 0.78 : 0.94);
    return Math.min(this.pixelRatio, budget);
  }

  onPointerMove(event) {
    if (this.disposed || this.mobile || (event.pointerType && event.pointerType !== 'mouse')) return;
    this.pointerParallax.targetX = ((event.clientX / Math.max(1, this.width)) * 2 - 1) * 0.28;
    this.pointerParallax.targetY = -((event.clientY / Math.max(1, this.height)) * 2 - 1) * 0.17;
  }

  onPointerLeave() {
    if (this.disposed) return;
    this.pointerParallax.targetX = 0;
    this.pointerParallax.targetY = 0;
  }

  /** Call from a real user gesture (for example, tapping the student-code input).
   * iOS Safari requires requestPermission() to happen inside that gesture. */
  async enableDeviceParallax() {
    if (this.disposed || !this.mobile || this.deviceParallaxEnabled || this.deviceParallaxPending || !('DeviceOrientationEvent' in window)) return false;
    this.deviceParallaxPending = true;
    try {
      const OrientationEvent = window.DeviceOrientationEvent;
      if (typeof OrientationEvent.requestPermission === 'function') {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== 'granted') return false;
      }
      if (this.disposed) return false;
      window.addEventListener('deviceorientation', this.boundDeviceOrientation, { passive: true });
      this.deviceParallaxEnabled = true;
      return true;
    } catch {
      // Motion sensors are optional; the scene remains fully usable without them.
      return false;
    } finally {
      this.deviceParallaxPending = false;
    }
  }

  onDeviceOrientation(event) {
    if (this.disposed || !this.mobile || event.gamma == null || event.beta == null) return;
    // Clamp sensor noise to a small, comfortable camera offset. A neutral upright
    // phone (beta around 45°) maps close to center; no large scene rotations occur.
    const clampUnit = value => Math.max(-1, Math.min(1, value));
    this.pointerParallax.targetX = clampUnit(event.gamma / 35) * 0.15;
    this.pointerParallax.targetY = -clampUnit((event.beta - 45) / 40) * 0.105;
  }

  updateBloomSettings() {
    if (!this.bloomPass) return;
    this.bloomPass.strength = this.degraded
      ? (this.mobile ? 0.05 : 0.08)
      : (this.mobile ? 0.07 : 0.11);
    this.bloomPass.strength *= this.degraded ? 1.1 : 1.45;
    this.bloomPass.threshold = this.mobile ? 0.90 : 0.89;
    this.bloomPass.radius = 0.18;
  }

  updateGalaxyTitleProtection() {
    if (!this.galaxy?.setTitleProtection) return;
    const viewportWidth = Math.max(1, this.width);
    const viewportHeight = Math.max(1, this.height);
    const cameraDistance = Math.max(0.1, this.camera.position.z);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * cameraDistance;
    const viewWidth = viewHeight * this.camera.aspect;
    const toNdcX = pixel => pixel / viewportWidth * 2 - 1;
    const toNdcY = pixel => 1 - pixel / viewportHeight * 2;
    let titleCenterX = 0;
    let titleCenterY = 0;
    let titleRadiusX = 0;
    let titleRadiusY = 0;
    let wishCenterX = 0;
    let wishCenterY = 0;
    let wishRadiusX = 0;
    let wishRadiusY = 0;

    if (this.artDirection && this.particles.hasRecipient) {
      const [halfWidth, halfHeight, centerY] = this.particles.titleBounds;
      const scale = this.particles.viewportScale;
      const titleCenterPixelY = (0.5 - centerY * scale.y / viewHeight) * viewportHeight;
      const halfWidthPixels = halfWidth * scale.x / viewWidth * viewportWidth + 22;
      const halfHeightPixels = halfHeight * scale.y / viewHeight * viewportHeight + 20;
      titleCenterX = 0;
      titleCenterY = toNdcY(titleCenterPixelY);
      titleRadiusX = halfWidthPixels * 2 / viewportWidth;
      titleRadiusY = halfHeightPixels * 2 / viewportHeight;

      const revealRect = this.titleProtectionNodes.reveal?.getBoundingClientRect();
      if (revealRect?.width && revealRect.height) {
        wishCenterX = toNdcX(revealRect.left + revealRect.width * 0.5);
        wishCenterY = toNdcY(revealRect.top + revealRect.height * 0.5);
        wishRadiusX = (revealRect.width * 0.5 + 24) * 2 / viewportWidth;
        wishRadiusY = (revealRect.height * 0.5 + 22) * 2 / viewportHeight;
      }
    } else {
      const [halfWidth, halfHeight, centerY] = this.particles.signatureBounds;
      const scale = this.particles.viewportScale;
      const titleCenterPixelY = (0.5 - centerY * scale.y / viewHeight) * viewportHeight;
      const halfWidthPixels = halfWidth * scale.x / viewWidth * viewportWidth + 26;
      const halfHeightPixels = halfHeight * scale.y / viewHeight * viewportHeight + 22;
      titleCenterX = 0;
      titleCenterY = toNdcY(titleCenterPixelY);
      titleRadiusX = halfWidthPixels * 2 / viewportWidth;
      titleRadiusY = halfHeightPixels * 2 / viewportHeight;

      const portalRect = this.titleProtectionNodes.portal?.getBoundingClientRect();
      if (portalRect?.width && portalRect.height) {
        wishCenterX = toNdcX(portalRect.left + portalRect.width * 0.5);
        wishCenterY = toNdcY(portalRect.top + portalRect.height * 0.5);
        wishRadiusX = (portalRect.width * 0.5 + 42) * 2 / viewportWidth;
        wishRadiusY = (portalRect.height * 0.5 + 38) * 2 / viewportHeight;
      }
    }

    this.galaxy.setTitleProtection(
      titleCenterX, titleCenterY, titleRadiusX, titleRadiusY,
      wishCenterX, wishCenterY, wishRadiusX, wishRadiusY,
      this.artDirection ? 0.62 : 0.88
    );
  }

  resizeNebulaTarget() {
    if (!this.nebulaTarget) return;
    const scale = this.mobile
      ? (this.degraded ? 0.18 : 0.24)
      : (this.degraded ? 0.29 : 0.40);
    this.nebulaScale = scale;
    this.nebulaTarget.setSize(
      Math.max(80, Math.floor(this.width * scale)),
      Math.max(80, Math.floor(this.height * scale))
    );
  }

  positionNebulaBillboard() {
    if (!this.nebulaBackground) return;
    const distance = 42;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(distance);
    this.nebulaBackground.position.copy(this.camera.position).add(forward);
    this.nebulaBackground.quaternion.copy(this.camera.quaternion);
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const width = height * this.camera.aspect;
    this.nebulaBackground.scale.set(width * 0.5, height * 0.5, 1);
  }

  renderNebulaPass() {
    // Render the volumetric cloud separately to preserve detail in the particle layers.
    const previousTarget = this.renderer.getRenderTarget();
    const oldColor = this.renderer.getClearColor(this._clearColor).clone();
    const oldAlpha = this.renderer.getClearAlpha();
    try {
      this.renderer.setRenderTarget(this.nebulaTarget);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.nebulaScene, this.camera);
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setClearColor(oldColor, oldAlpha);
    }
    this.positionNebulaBillboard();
  }

  createCoreAndShockwaves() {
    const texture = makeCoreTexture();
    const material = new THREE.SpriteMaterial({
      map: texture, color: '#d7b6ff', transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true
    });
    this.core = new THREE.Sprite(material);
    this.core.position.set(0, 0, 0.8);
    this.core.scale.set(0.001, 0.001, 1);
    this.core.visible = false;
    this.core.renderOrder = 3;
    this.scene.add(this.core);

    this.shockwaves = [];
    this.waveTimelines = [];
    for (let i = 0; i < 3; i++) {
      const waveMaterial = new THREE.MeshBasicMaterial({
        color: this.palette[i], transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: true
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 128), waveMaterial);
      mesh.position.z = 0.25 - i * 0.03;
      mesh.visible = false;
      mesh.scale.setScalar(0.001);
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.shockwaves.push(mesh);
    }
  }

  setPalette(palette = DEFAULT_PALETTE) {
    this.palette = palette.slice();
    setVolumePalette(this.nebula, palette);
    this.comets.setPalette(palette);
    this.attractor.setPalette(palette);
    this.galaxy.setPalette(palette);
    this.shockwaves.forEach((wave, i) => wave.material.color.set(palette[i % palette.length]));
    this.core.material.color.set(palette[2] || COSMIC_COLORS.champagne);
    this.particles.setPalette(palette);
    this.nebulaFlow.setPalette(palette);
    this.mathCurves?.setPalette(palette);
  }

  setArtDirection(direction) {
    this.artDirection = direction || null;
    this.galaxy.setArtDirection(direction);
    this.comets.setArtDirection(direction);
    if (!direction) this.galaxy.setProfile(null, null, null, gsap, this.reducedMotion);
    setVolumeArtDirection(this.nebula, direction);
    this.nebula.uniforms.uDensity.value = direction ? 0.04 : 0.12;
    const titleBounds = direction ? this.particles.titleBounds : this.particles.signatureBounds;
    setVolumeTitleProtection(this.nebula, titleBounds, this.particles.viewportScale);
    this.nebulaFlow.setDirection(direction);
    this.nebulaFlow.setTitleBounds(titleBounds, this.particles.viewportScale);
    this.updateGalaxyTitleProtection();
  }

  triggerCentrifugal(x, y, strength = 1) {
    const time = this.elapsed;
    pulseNebulaVolume(this.nebula, x, y, time, strength);
    this.galaxy.triggerCentrifugal(x, y, time, strength);
    this.stars.layers.forEach(layer => {
      layer.uniforms.uCentrifugal.value.set(x, y, strength);
      layer.uniforms.uCentrifugalTime.value = time;
    });
    this.particles.triggerCentrifugal(
      x / Math.max(0.1, this.particles.viewportScale.x),
      y / Math.max(0.1, this.particles.viewportScale.y),
      time,
      this.artDirection ? strength : strength * 0.22
    );
    this.nebulaFlow.triggerCentrifugal(x, y, time, strength);
    this.comets.triggerPulse(x, y, time, strength);
    this.mathCurves?.triggerCentrifugal(x, y, time, strength);
  }

  cosmicEventCenter(sequence = 0, { idle = false } = {}) {
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.camera.position.z;
    const viewWidth = viewHeight * this.camera.aspect;
    const rect = document.querySelector('#reveal')?.getBoundingClientRect();
    const identity = document.querySelector('#identity')?.getBoundingClientRect();
    const portal = idle ? document.querySelector('#portal')?.getBoundingClientRect() : null;
    if (idle && portal?.width) {
      const pixelX = this.width * (sequence % 2 ? 0.42 : 0.58);
      const pixelY = THREE.MathUtils.clamp(portal.top * 0.38, 28, this.height * 0.42);
      return {
        x: (pixelX / this.width - 0.5) * viewWidth,
        y: (0.5 - pixelY / this.height) * viewHeight,
        z: -0.8 - (sequence % 3) * 0.55,
        protectRect: [
          portal.left / this.width * 2 - 1,
          1 - portal.bottom / this.height * 2,
          portal.right / this.width * 2 - 1,
          1 - portal.top / this.height * 2
        ],
        titleProtectRect: [2, 2, 3, 3]
      };
    }
    const midX = rect?.width ? rect.left + rect.width * 0.5 : this.width * 0.5;
    const midY = rect?.height ? rect.top + rect.height * 0.5 : this.height * 0.62;
    const bounds = rect?.width ? rect : { left: this.width * 0.34, right: this.width * 0.66, top: this.height * 0.62, bottom: this.height * 0.9 };
    const [titleHalfWidth, titleHalfHeight, titleCenterY] = this.particles.titleBounds || [0, 0, 0];
    const titleScale = this.particles.viewportScale;
    const titleLeft = this.width * 0.5 - titleHalfWidth * titleScale.x / viewWidth * this.width - 18;
    const titleRight = this.width * 0.5 + titleHalfWidth * titleScale.x / viewWidth * this.width + 18;
    const titleCenterPixelY = (0.5 - titleCenterY * titleScale.y / viewHeight) * this.height;
    const titleHalfPixelHeight = titleHalfHeight * titleScale.y / viewHeight * this.height + 16;
    const titleBounds = {
      left: Math.min(titleLeft, identity?.left ?? titleLeft),
      right: Math.max(titleRight, identity?.right ?? titleRight),
      top: Math.min(titleCenterPixelY - titleHalfPixelHeight, identity?.top ?? titleCenterPixelY - titleHalfPixelHeight),
      bottom: Math.max(titleCenterPixelY + titleHalfPixelHeight, identity?.bottom ?? titleCenterPixelY + titleHalfPixelHeight)
    };
    const clearBounds = {
      left: Math.min(bounds.left, titleBounds.left),
      right: Math.max(bounds.right, titleBounds.right),
      top: Math.min(bounds.top, titleBounds.top),
      bottom: Math.max(bounds.bottom, titleBounds.bottom)
    };
    const candidates = [
      { x: midX, y: clearBounds.top - 58, space: clearBounds.top },
      { x: midX, y: clearBounds.bottom + 58, space: this.height - clearBounds.bottom },
      { x: clearBounds.left - 58, y: midY, space: clearBounds.left },
      { x: clearBounds.right + 58, y: midY, space: this.width - clearBounds.right }
    ].filter(candidate => candidate.space >= 150 &&
      candidate.x >= 24 && candidate.x <= this.width - 24 &&
      candidate.y >= 24 && candidate.y <= this.height - 24);
    const ordered = (candidates.length ? candidates : [{ x: midX, y: clearBounds.top - 32, space: clearBounds.top }])
      .map((candidate, index) => ({ ...candidate, index }))
      .sort((a, b) => b.space - a.space);
    const selected = ordered[sequence % Math.min(2, ordered.length)];
    const pixelX = THREE.MathUtils.clamp(selected.x, 24, this.width - 24);
    const pixelY = THREE.MathUtils.clamp(selected.y, 24, this.height - 24);
    return {
      x: (pixelX / this.width - 0.5) * viewWidth,
      y: (0.5 - pixelY / this.height) * viewHeight,
      z: -0.8 - (sequence % 3) * 0.55,
      protectRect: rect?.width ? [
        bounds.left / this.width * 2 - 1,
        1 - bounds.bottom / this.height * 2,
        bounds.right / this.width * 2 - 1,
        1 - bounds.top / this.height * 2
      ] : [2, 2, 3, 3],
      titleProtectRect: [
        titleBounds.left / this.width * 2 - 1,
        1 - titleBounds.bottom / this.height * 2,
        titleBounds.right / this.width * 2 - 1,
        1 - titleBounds.top / this.height * 2
      ]
    };
  }

  playCosmicEvent(name, { sequence = 0, cycle = 0, idle = false } = {}) {
    if (this.disposed || (!this.artDirection && !idle)) return null;
    const profileKey = this.artDirection?.galaxy || 'twinSpiral';
    const profile = idle && this.galaxy?.currentGatewayProfile ? this.galaxy.currentGatewayProfile : GALAXY_PROFILES[profileKey];
    const modes = {
      stellarSupernova: 0,
      meteorStorm: 1,
      meteorPassage: 1,
      mathematicalBloom: 2,
      mathematicalUniverse: 2,
      centrifugalRift: 3,
      centrifugalWave: 3,
      stardustRebirth: 4,
      stellarGenesis: 4,
      galacticHeartbeat: 5,
      galacticRings: 5,
      cosmicLens: 6,
      cosmicConstellation: 7,
      stardustCascade: 7
    };
    const curves = ['lemniscate', 'trochoid', 'rose', 'superformula', 'logSpiral', 'lissajous', 'phyllotaxis', 'epicycle', 'butterfly'];
    const curve = curves.indexOf(profile.curve);
    const mode = modes[name];
    if (mode == null) throw new Error(`Unknown cosmic event: ${name}`);

    // A new event owns a clean slate: abort the previous choreography and its
    // shockwave timelines before any new light or motion is scheduled.
    this.stopCosmicEvent();
    const center = this.cosmicEventCenter(sequence + cycle, { idle });
    this.cosmicEventLayer.setEvent(mode, profile, this.palette, center, curve < 0 ? 0 : curve);
    const uniforms = this.cosmicEventLayer.uniforms;
    const timeline = gsap.timeline({
      onComplete: () => {
        uniforms.uIntensity.value = 0;
        uniforms.uProgress.value = 0;
        this.cosmicTimeline = null;
      }
    });
    this.cosmicTimeline = timeline;
    const slow = this.reducedMotion;
    const prepare = slow ? 0.36 : 0.75;
    const peak = slow ? 0.68 : 1.25;
    const recover = slow ? 0.48 : 1.0;
    const titleY = this.particles.titleBounds?.[2] ?? 0.72;
    const pulseY = Math.max(-1.2, Math.min(1.2, titleY * 0.32));

    timeline
      .to(uniforms.uIntensity, { value: 0.52, duration: prepare, ease: 'sine.inOut' }, 0)
      .to(uniforms.uProgress, { value: 0.24, duration: prepare, ease: 'power2.in' }, 0);

    if (name === 'stellarSupernova') {
      timeline
        .call(() => {
          this.triggerCentrifugal(center.x * 0.16, center.y * 0.16, slow ? 0.55 : 1.35);
          if (!idle) this.fireShockwaves();
          else this.fireIdleShockwaves(center);
          this.comets.triggerPulse(center.x, center.y, this.elapsed, 1.2);
        })
        .to(this.galaxy.uniforms.uNova, { value: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, '<')
        .to(uniforms.uIntensity, { value: 1.12, duration: peak, ease: 'expo.out' })
        .to(uniforms.uProgress, { value: 0.84, duration: peak, ease: 'power3.out' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'sine.inOut' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'meteorStorm' || name === 'meteorPassage') {
      timeline
        .call(() => {
          this.comets.triggerPulse(center.x, center.y, this.elapsed, 1.18);
          this.triggerCentrifugal(center.x * 0.08, center.y * 0.08, slow ? 0.2 : 0.45);
        })
        .to(uniforms.uIntensity, { value: 0.92, duration: peak, ease: 'power2.out' })
        .to(uniforms.uProgress, { value: 0.82, duration: peak * 1.25, ease: 'none' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'power2.in' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'mathematicalBloom' || name === 'mathematicalUniverse') {
      timeline
        .call(() => {
          this.triggerCentrifugal(center.x * 0.1, center.y * 0.1, slow ? 0.3 : 0.62);
          this.mathCurves?.reveal(gsap, slow);
        })
        .to(uniforms.uProgress, { value: 0.78, duration: peak * 1.45, ease: 'sine.inOut' })
        .to(uniforms.uIntensity, { value: 0.9, duration: 0.32, ease: 'sine.out' }, '<0.2')
        .call(() => this.nebulaFlow.triggerCentrifugal(center.x * 0.12, center.y * 0.12, this.elapsed, 0.55))
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'power2.out' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'centrifugalRift' || name === 'centrifugalWave') {
      timeline
        .call(() => {
          this.triggerCentrifugal(center.x * 0.12, center.y * 0.12, slow ? 0.4 : 0.98);
          this.galaxy.uniforms.uNova.value = 0.85;
        })
        .to(uniforms.uIntensity, { value: 0.95, duration: peak, ease: 'power2.inOut' })
        .to(this.galaxy.uniforms.uNova, { value: 0.25, duration: 1.5, ease: 'sine.out' }, '<')
        .to(uniforms.uProgress, { value: 0.84, duration: peak, ease: 'power2.in' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'power2.out' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'stardustRebirth' || name === 'stellarGenesis') {
      timeline
        .call(() => {
          this.triggerCentrifugal(0, 0, slow ? 0.35 : 0.88);
          this.nebulaFlow.triggerCentrifugal(0, 0, this.elapsed, 0.75);
          this.galaxy.uniforms.uNova.value = 1.05;
        })
        .to(uniforms.uIntensity, { value: 0.88, duration: peak, ease: 'sine.inOut' })
        .to(this.galaxy.uniforms.uNova, { value: 0.25, duration: 1.8, ease: 'power2.out' }, '<')
        .to(uniforms.uProgress, { value: 0.82, duration: peak * 1.35, ease: 'power2.inOut' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'sine.out' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'galacticHeartbeat' || name === 'galacticRings') {
      timeline
        .call(() => this.triggerCentrifugal(0, pulseY, slow ? 0.28 : 0.68))
        .to(this.galaxy.uniforms.uNova, { value: 0.92, duration: peak * 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' })
        .to(uniforms.uIntensity, { value: 0.82, duration: peak, ease: 'sine.inOut' }, '<')
        .to(uniforms.uProgress, { value: 0.82, duration: peak * 1.3, ease: 'sine.inOut' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'sine.out' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else if (name === 'cosmicLens') {
      timeline
        .call(() => this.triggerCentrifugal(center.x * 0.15, center.y * 0.15, slow ? 0.25 : 0.54))
        .to(uniforms.uIntensity, { value: 0.78, duration: peak, ease: 'sine.inOut' })
        .to(uniforms.uProgress, { value: 0.84, duration: peak * 1.1, ease: 'power2.out' }, '<')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'sine.inOut' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    } else {
      timeline
        .call(() => {
          this.triggerCentrifugal(center.x * 0.08, center.y * 0.08, slow ? 0.22 : 0.42);
          this.nebulaFlow.triggerCentrifugal(0, 0.7, this.elapsed, 0.7);
        })
        .to(uniforms.uProgress, { value: 0.82, duration: peak * 1.3, ease: 'power2.inOut' })
        .to(uniforms.uIntensity, { value: 0.78, duration: peak, ease: 'sine.out' }, '<0.18')
        .to(uniforms.uProgress, { value: 1, duration: recover, ease: 'sine.inOut' })
        .to(uniforms.uIntensity, { value: 0, duration: recover, ease: 'sine.out' }, '<');
    }
    window.dispatchEvent(new CustomEvent('stellar:cosmic-event', {
      detail: { name, sequence, cycle, profile: profileKey, idle, duration: Number(timeline.duration().toFixed(3)) }
    }));
    return timeline;
  }

  stopCosmicEvent() {
    this.cosmicTimeline?.kill();
    this.cosmicTimeline = null;
    this.waveTimelines?.forEach(timeline => timeline.kill());
    this.waveTimelines = [];
    this.shockwaves?.forEach(wave => {
      wave.visible = false;
      wave.material.opacity = 0;
      wave.scale.setScalar(0.001);
    });
    if (this.cosmicEventLayer) {
      this.cosmicEventLayer.uniforms.uIntensity.value = 0;
      this.cosmicEventLayer.uniforms.uProgress.value = 0;
    }
    if (this.galaxy?.uniforms?.uNova) this.galaxy.uniforms.uNova.value = 0.22;
  }

  setRecipient(recipient) {
    if (!recipient) {
      this.bodies.setRecipient(null);
      this.setPalette(DEFAULT_PALETTE);
      this.setArtDirection(null);
      this.particles.resetEvent();
      this.nebulaFlow.clearInteraction();
      this.particles.setRecipient('20·10');
      this.particles.resetRecipientTransition();
      this.particles.startIdleMorph(gsap);
      this.attractor.hide(gsap);
      return;
    }
    const direction = getRecipientArtDirection(recipient);
    this.particles.setRecipient(recipient.display, direction);
    this.setArtDirection(direction);
    this.galaxy.setProfile(direction, recipient.palette, recipient.id, gsap, this.reducedMotion);
    this.setPalette(recipient.palette);
    this.bodies.setRecipient(recipient, direction);
  }

  triggerBomb(recipient, onComplete = () => {}) {
    this.stopCosmicEvent();
    this.eventTimeline?.kill();
    this.eventTimeline = null;
    this.attractorTimeline?.kill();
    this.attractorTimeline = null;
    this.waveTimelines.forEach(tl => tl.kill()); this.waveTimelines = [];
    // The end of a previous reveal can leave short cosmetic tweens alive outside
    // its main timeline. Kill them before another recipient takes ownership.
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.core.material);
    gsap.killTweensOf(this.core.scale);
    gsap.killTweensOf(this.attractor?.line?.material);
    gsap.killTweensOf(this.attractor?.group?.scale);
    gsap.killTweensOf('#eventFlash');
    gsap.set('#eventFlash', { opacity: 0 });
    const u = this.particles.uniforms;
    const direction = getRecipientArtDirection(recipient);
    const reveal = direction.reveal;
    this.particles.stopIdleMorph();
    this.particles.resetEvent();
    this.particles.setRecipient(recipient.display, direction);
    this.bodies.setRecipient(recipient, direction);
    this.setArtDirection(direction);
    this.galaxy.setProfile(direction, recipient.palette, recipient.id, gsap, this.reducedMotion);
    this.setPalette(recipient.palette);
    this.attractor.group.visible = false;
    this.triggerCentrifugal(0, 0.52, this.reducedMotion ? 0.25 : 0.48);
    this.core.visible = true;
    this.core.material.opacity = 0;
    this.core.scale.setScalar(0.001);
    this.shockwaves.forEach(wave => {
      wave.visible = false; wave.material.opacity = 0; wave.scale.setScalar(0.001);
    });

    const timeline = gsap.timeline({
      onComplete: () => {
        this.onPhase('settled');
        this.particles.recipientTransitionPending = false;
        this.attractor.hide(gsap);
        this.core.visible = true;
        gsap.to(this.core.material, { opacity: 0.14, duration: 1.0, ease: 'sine.inOut' });
        gsap.to(this.core.scale, { x: 0.78, y: 0.78, duration: 1.25, ease: 'sine.inOut' });
        onComplete();
      }
    });
    this.eventTimeline = timeline;
    const motion = this.reducedMotion ? 1.45 : 1;
    const settle = this.reducedMotion ? 1.2 : reveal.settle;
    timeline
      .call(() => this.onPhase('charge'))
      .to(u.uCharge, { value: 1, duration: 1.0 * motion, ease: 'power3.in' })
      .to(this.camera.position, { z: this.reducedMotion ? 10.1 : reveal.cameraZ, duration: 0.85 * motion, ease: 'power2.in' }, '<0.1')
      .to(this.core.material, { opacity: 0.9, duration: 0.32, ease: 'power2.in' }, '<0.2')
      .to(this.core.scale, { x: 1.8, y: 1.8, duration: 0.75, ease: 'expo.in' }, '<')
      .to(u.uCharge, { value: 0, duration: 0.22, ease: 'power2.out' })
      .call(() => {
        this.onPhase('burst');
        this.triggerCentrifugal(0, 0.52, this.reducedMotion ? 0.62 : 1.25);
        this.fireShockwaves();
        this.attractorTimeline?.kill();
        this.attractorTimeline = this.attractor.reveal(gsap);
        this.onBurst();
        gsap.fromTo('#eventFlash', { opacity: 0 }, { opacity: 0.8, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
      })
      .to(u.uBurst, { value: this.reducedMotion ? 0.48 : reveal.burst, duration: (this.reducedMotion ? 1.2 : 0.88), ease: 'expo.out' }, '<')
      .to(this.core.scale, { x: this.reducedMotion ? 2.5 : 4.2, y: this.reducedMotion ? 2.5 : 4.2, duration: 0.9 * motion, ease: 'expo.out' }, '<')
      .to(this.core.material, { opacity: 0, duration: 0.72, ease: 'power2.out' }, '<0.02')
      .call(() => this.onPhase('reform'), null, '+=0.04')
      .to(u.uReform, { value: 1, duration: 1.6 * settle, ease: 'power4.out' }, '<')
      .to(u.uRecipientMix, { value: 1, duration: 1.82 * settle, ease: 'power4.out' }, '<0.08')
      .to(u.uRecipientTransition, { value: 1, duration: 1.82 * settle, ease: 'power3.inOut' }, '<')
      .to(u.uBurst, { value: 0, duration: 1.45 * settle, ease: 'power2.out' }, '<')
      .to(this.camera.position, { z: 12.6, duration: 1.65, ease: 'power3.out' }, '<0.08')
      .to(u.uMorph, { value: 0, duration: 0.3, ease: 'sine.out' }, '<0.6')
      .to(u.uNova, { value: 1, duration: this.reducedMotion ? 0.08 : 0.16, ease: 'sine.out' }, '<0.35')
      .to(this.galaxy.uniforms.uNova, { value: 1, duration: this.reducedMotion ? 0.08 : 0.16, ease: 'sine.out' }, '<')
      .to(u.uNova, { value: 0, duration: this.reducedMotion ? 0.42 : 1.45, ease: 'sine.inOut' }, '<0.08')
      .to(this.galaxy.uniforms.uNova, { value: 0.22, duration: this.reducedMotion ? 0.42 : 1.45, ease: 'sine.inOut' }, '<');
    return timeline;
  }


  resetToIdle() {
    this.stopCosmicEvent();
    this.eventTimeline?.kill();
    this.eventTimeline = null;
    this.attractorTimeline?.kill();
    this.attractorTimeline = null;
    // Reset also owns the tiny post-reveal glints and camera settling tweens,
    // which are intentionally outside the bomb timeline for a softer landing.
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.core?.material);
    gsap.killTweensOf(this.core?.scale);
    gsap.killTweensOf(this.attractor?.line?.material);
    gsap.killTweensOf(this.attractor?.group?.scale);
    gsap.killTweensOf('#eventFlash');
    gsap.set('#eventFlash', { opacity: 0 });
    this.bodies.setRecipient(null);
    this.setPalette(DEFAULT_PALETTE);
    this.setArtDirection(null);
    this.galaxy?.startGatewayMorphing?.(gsap, this.reducedMotion);
    this.mathCurves?.reveal?.(gsap, this.reducedMotion);
    this.waveTimelines.forEach(tl => tl.kill()); this.waveTimelines = [];
    this.particles.resetEvent();
    this.nebulaFlow.clearInteraction();
    this.particles.setRecipient('20·10');
    this.particles.resetRecipientTransition();
    this.particles.startIdleMorph(gsap);
    this.attractor.hide(gsap);
    this.core.visible = false;
    this.core.material.opacity = 0;
    this.core.scale.setScalar(0.001);
    this.shockwaves.forEach(wave => { wave.visible = false; wave.material.opacity = 0; wave.scale.setScalar(0.001); });
    gsap.to(this.camera.position, { x: 0, y: 0, z: 12.6, duration: 0.85, ease: 'power3.out', overwrite: true });
    this.onPhase('idle');
  }

  fireShockwaves() {
    this.shockwaves.forEach((wave, i) => {
      wave.visible = true;
      wave.position.set(0, 0, 0.25 - i * 0.03);
      wave.material.opacity = 0;
      wave.scale.setScalar(0.04);
      let waveTimeline;
      waveTimeline = gsap.timeline({
        delay: i * 0.12,
        onComplete: () => {
          const index = this.waveTimelines.indexOf(waveTimeline);
          if (index >= 0) this.waveTimelines.splice(index, 1);
        }
      });
      waveTimeline
        .to(wave.material, { opacity: 0.56 - i * 0.1, duration: 0.12, ease: 'power2.out' }, 0)
        .to(wave.scale, { x: 10.5 + i * 1.4, y: 10.5 + i * 1.4, duration: 1.45 + i * 0.08, ease: 'expo.out' }, 0)
        .to(wave.material, { opacity: 0, duration: 1.35, ease: 'sine.out' }, 0.1)
        .set(wave, { visible: false });
      this.waveTimelines.push(waveTimeline);
    });
  }

  fireIdleShockwaves(center) {
    this.shockwaves.forEach((wave, i) => {
      wave.visible = true;
      wave.position.set(center.x * 0.14, center.y * 0.14, -1.2);
      wave.material.opacity = 0;
      wave.scale.setScalar(0.04);
      let waveTimeline;
      waveTimeline = gsap.timeline({
        delay: i * 0.14,
        onComplete: () => {
          const index = this.waveTimelines.indexOf(waveTimeline);
          if (index >= 0) this.waveTimelines.splice(index, 1);
        }
      });
      waveTimeline
        .to(wave.material, { opacity: 0.42 - i * 0.08, duration: 0.15, ease: 'power2.out' }, 0)
        .to(wave.scale, { x: 8.5 + i * 1.2, y: 8.5 + i * 1.2, duration: 1.6 + i * 0.1, ease: 'expo.out' }, 0)
        .to(wave.material, { opacity: 0, duration: 1.45, ease: 'sine.out' }, 0.12)
        .set(wave, { visible: false });
      this.waveTimelines.push(waveTimeline);
    });
  }

  onPointerDown(event) {
    if (this.disposed || this.hidden) return;
    const ndc = new THREE.Vector3(
      (event.clientX / Math.max(1, this.width)) * 2 - 1,
      -(event.clientY / Math.max(1, this.height)) * 2 + 1,
      0.5
    ).unproject(this.camera);
    const ray = ndc.sub(this.camera.position).normalize();
    if (Math.abs(ray.z) < 0.0001) return;
    const point = this.camera.position.clone().add(ray.multiplyScalar(-this.camera.position.z / ray.z));
    this.triggerCentrifugal(point.x, point.y, this.reducedMotion ? 0.32 : this.mobile ? 0.62 : 0.88);
  }

  onVisibility() {
    this.hidden = document.hidden;
    this.lastFrame = 0;
    if (this.hidden && this.tickerActive) {
      gsap.ticker.remove(this.boundTick);
      this.tickerActive = false;
    } else if (!this.hidden && !this.paused && !this.tickerActive && !this.disposed) {
      gsap.ticker.add(this.boundTick);
      this.tickerActive = true;
    }
  }

  pause() {
    if (this.disposed || this.paused) return;
    this.paused = true;
    this.lastFrame = 0;
    if (this.tickerActive) {
      gsap.ticker.remove(this.boundTick);
      this.tickerActive = false;
    }
  }

  resume() {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    this.lastFrame = 0;
    if (!this.hidden && !document.hidden && !this.tickerActive) {
      gsap.ticker.add(this.boundTick);
      this.tickerActive = true;
    }
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    this.width = width;
    this.height = height;
    const newMobile = matchMedia('(pointer: coarse)').matches || width < 720 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    this.mobile = Boolean(newMobile);
    this.maxPixelRatio = this.mobile ? 1 : 1.35;
    const qualityCap = this.degraded ? (this.mobile ? 0.72 : 0.92) : this.maxPixelRatio;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio, qualityCap);

    // Resize both the drawing buffer and camera projection. EffectComposer.setSize
    // propagates the same logical dimensions to RenderPass and UnrealBloomPass.
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.resizeNebulaTarget();
    this.composer.setPixelRatio(this.composerPixelRatio());
    this.composer.setSize(width, height);
    this.updateBloomSettings();
    this.positionNebulaBillboard();

    this.particles.setPixelRatio(this.pixelRatio);
    this.particles.setViewport(width, height);
    this.setArtDirection(this.artDirection);
    this.stars.layers.forEach(layer => { layer.uniforms.uPixelRatio.value = this.pixelRatio; });
    this.galaxy.setPixelRatio(this.pixelRatio);
    this.galaxy.setViewport(width, height, this.camera.position.z, this.camera.fov);
    this.cosmicEventLayer.setPixelRatio(this.pixelRatio);
    this.cosmicEventLayer.setViewport(width, height, this.camera.position.z, this.camera.fov);
    this.comets.setPixelRatio(this.pixelRatio);
    this.comets.setViewport(width, height, this.camera.position.z, this.camera.fov);
    this.nebulaFlow.setViewport(width, height, this.pixelRatio);
    this.mathCurves?.setPixelRatio(this.pixelRatio);
    this.mathCurves?.setViewport(width, height);
    this.nebula.uniforms.uSteps.value = this.degraded ? (this.mobile ? 2 : 3) : (this.mobile ? 3 : 5);
    this.nebula.uniforms.uFbmOctaves.value = this.degraded ? 2 : (this.mobile ? 2 : 3);
    this.frameCount = 0;
    this.qualityClock = 0;
    this.lastFrame = 0;
  }

  tick(time, deltaMs) {
    if (this.disposed || this.hidden || this.paused) return;
    const frameInterval = Math.max(0.001, (deltaMs || 16.67) / 1000);
    const dt = Math.min(0.04, frameInterval);
    this.elapsed += dt * (this.reducedMotion ? 0.35 : 1);
    this.frameCount++;
    // Measure real elapsed time for quality decisions; dt stays clamped for animation stability.
    this.qualityClock += frameInterval;
    this.nebula.uniforms.uTime.value = this.elapsed;
    this.stars.layers.forEach(layer => { layer.uniforms.uTime.value = this.elapsed; });
    this.galaxy.setTime(this.elapsed);
    if (this.elapsed >= this.nextTitleProtectionUpdate) {
      this.updateGalaxyTitleProtection();
      this.nextTitleProtectionUpdate = this.elapsed + 0.2;
    }
    this.cosmicEventLayer.setTime(this.elapsed);
    this.particles.setTime(this.elapsed);
    this.nebulaFlow.setTime(this.elapsed);
    this.mathCurves?.setTime(this.elapsed);
    this.bodies.update(this.elapsed, this.camera.position.z, this.camera.aspect, this.camera.fov);
    this.comets.update(this.elapsed);
    this.attractor.update(this.elapsed, this.particles.uniforms.uBurst.value);
    // Ease pointer targets rather than moving the camera directly from raw input.
    // This creates depth without jitter and is disabled on touch-first devices.
    const recipientActive = this.particles.uniforms.uRecipientMix.value > 0.4;
    const parallaxEase = Math.min(1, dt * 2.6);
    this.pointerParallax.x += (this.pointerParallax.targetX - this.pointerParallax.x) * parallaxEase;
    this.pointerParallax.y += (this.pointerParallax.targetY - this.pointerParallax.y) * parallaxEase;
    const driftX = Math.sin(this.elapsed * 0.12) * (recipientActive ? 0.19 : 0.09);
    const driftY = Math.cos(this.elapsed * 0.10) * (recipientActive ? 0.12 : 0.06);
    const targetX = driftX + this.pointerParallax.x;
    const targetY = driftY + this.pointerParallax.y;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 0.42);
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 0.40);
    this.camera.lookAt(0, 0, 0);
    this.renderNebulaPass();
    this.composer.render(dt);
    if (this.qualityClock >= 2.0) this.evaluateQuality();
  }

  evaluateQuality() {
    if (this.disposed) return;
    const fps = this.frameCount / this.qualityClock;
    this.frameCount = 0;
    this.qualityClock = 0;
    if (fps < 50) { this.lowFpsWindows++; this.highFpsWindows = 0; }
    else if (fps > 57) { this.highFpsWindows++; this.lowFpsWindows = 0; }
    else { this.lowFpsWindows = 0; this.highFpsWindows = 0; }
    if (!this.degraded && this.lowFpsWindows >= 2) {
      this.degraded = true;
      this.pixelRatio = Math.min(this.pixelRatio, this.mobile ? 0.72 : 0.92);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.particles.setPixelRatio(this.pixelRatio);
      this.particles.setViewport(this.width, this.height);
      this.nebulaFlow.setViewport(this.width, this.height, this.pixelRatio);
      this.setArtDirection(this.artDirection);
      this.stars.layers.forEach(layer => { layer.uniforms.uPixelRatio.value = this.pixelRatio; });
      this.galaxy.setPixelRatio(this.pixelRatio);
      this.cosmicEventLayer.setPixelRatio(this.pixelRatio);
      this.comets.setPixelRatio(this.pixelRatio);
      this.nebula.uniforms.uSteps.value = this.mobile ? 2 : 3;
      this.nebula.uniforms.uFbmOctaves.value = 2;
      this.resizeNebulaTarget();
      this.composer.setPixelRatio(this.composerPixelRatio());
      this.composer.setSize(this.width, this.height);
      this.updateBloomSettings();
    } else if (this.degraded && this.highFpsWindows >= 5) {
      this.degraded = false;
      this.resize();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = 0;
    if (this.tickerActive) gsap.ticker.remove(this.boundTick);
    this.tickerActive = false;

    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
      window.removeEventListener('orientationchange', this.boundResize);
      window.visualViewport?.removeEventListener('resize', this.boundResize);
    }
    if (this.boundVisibility) document.removeEventListener('visibilitychange', this.boundVisibility);
    if (this.boundPointerMove) window.removeEventListener('pointermove', this.boundPointerMove);
    if (this.boundPointerLeave) window.removeEventListener('pointerleave', this.boundPointerLeave);
    if (this.boundPointerDown) window.removeEventListener('pointerdown', this.boundPointerDown);
    if (this.boundDeviceOrientation) window.removeEventListener('deviceorientation', this.boundDeviceOrientation);
    this.deviceParallaxEnabled = false;
    if (this.canvas && this.boundContextLost) this.canvas.removeEventListener('webglcontextlost', this.boundContextLost);

    // Stop all scene-owned timelines/tweens before releasing any resources they
    // might touch. This makes fallback activation and hot reload idempotent.
    this.eventTimeline?.kill();
    this.eventTimeline = null;
    this.stopCosmicEvent();
    this.attractorTimeline?.kill();
    this.attractorTimeline = null;
    this.waveTimelines?.forEach(timeline => timeline.kill());
    this.waveTimelines = [];
    gsap.killTweensOf(this.camera?.position);
    gsap.killTweensOf(this.core?.material);
    gsap.killTweensOf(this.core?.scale);
    gsap.killTweensOf(this.attractor?.line?.material);
    gsap.killTweensOf(this.attractor?.group?.scale);
    gsap.killTweensOf(this.mathCurves?.uniforms?.uReveal);
    gsap.killTweensOf(this.mathCurves?.uniforms?.uEnergy);
    gsap.killTweensOf(this.mathCurves?.uniforms?.uResonance);
    this.shockwaves?.forEach(wave => {
      gsap.killTweensOf(wave.material);
      gsap.killTweensOf(wave.scale);
    });

    // Component classes dispose their own geometry/material pairs. Remove the
    // objects from their parent scenes first so nothing keeps GPU resources alive.
    this.particles?.dispose();
    this.cosmicEventLayer?.dispose();
    this.nebulaFlow?.dispose();
    this.mathCurves?.dispose();
    this.bodies?.dispose();
    this.comets?.dispose();
    this.stars?.layers?.forEach(layer => {
      this.scene.remove(layer.points);
      layer.geometry.dispose();
      layer.material.dispose();
    });
    this.galaxy?.dispose();
    if (this.nebula) {
      this.nebulaScene.remove(this.nebula.mesh);
      this.nebula.mesh.geometry.dispose();
      this.nebula.material.dispose();
    }
    if (this.nebulaBackground) {
      this.scene.remove(this.nebulaBackground);
      this.nebulaBackground.geometry.dispose();
      this.nebulaBackground.material.map = null;
      this.nebulaBackground.material.dispose();
    }
    this.nebulaTarget?.dispose();

    this.shockwaves?.forEach(wave => {
      this.scene.remove(wave);
      wave.geometry.dispose();
      wave.material.dispose();
    });
    if (this.core) {
      this.scene.remove(this.core);
      this.core.material.map?.dispose();
      this.core.material.map = null;
      this.core.material.dispose();
    }
    if (this.attractor?.group) {
      this.scene.remove(this.attractor.group);
      this.attractor.group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    }

    this.bloomPass?.dispose?.();
    this.identityPass?.dispose?.();
    this.outputPass?.dispose?.();
    this.composer?.dispose?.();
    this.renderer?.dispose();
    // Explicit context release helps browsers reclaim the GPU context promptly
    // when the app switches to the Canvas 2D fallback after context loss.
    this.renderer?.forceContextLoss?.();
  }

}
