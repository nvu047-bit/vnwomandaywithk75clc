import * as THREE from 'three';
import {
  cometTrailVertexShader, cometTrailFragmentShader,
  cometHeadVertexShader, cometHeadFragmentShader
} from './shaders.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';
import { GALAXY_PROFILES } from '../data/galaxyProfiles.js';

const rand = (a, b) => a + Math.random() * (b - a);
const DEFAULT_PALETTE = [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.roseQuartz, COSMIC_COLORS.mutedTeal];

/**
 * Meteor streaks cross the view in short, directional passes. Each tail is a
 * camera-facing ribbon mesh with a tapered fade from a bright head to dust.
 */
export class CometField {
  constructor(scene, {
    pixelRatio = 1, mobile = false, palette = DEFAULT_PALETTE,
    width = innerWidth, height = innerHeight, cameraZ = 12.6, fov = 43
  } = {}) {
    this.scene = scene;
    this.pixelRatio = pixelRatio;
    this.scratch = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.view = new THREE.Vector3(0, 0, 1);
    this.currentTime = 0;
    this.pulseCenter = new THREE.Vector2();
    this.pulseTime = -100;
    this.pulseStrength = 0;
    this.width = width;
    this.height = height;
    this.cameraZ = cameraZ;
    this.fov = fov;
    const count = mobile ? 8 : 20;
    const trailSamples = mobile ? 18 : 32;
    this.comets = [];

    for (let i = 0; i < count; i++) {
      const positions = new Float32Array(trailSamples * 2 * 3);
      const fades = new Float32Array(trailSamples * 2);
      const edges = new Float32Array(trailSamples * 2);
      const indices = [];
      for (let j = 0; j < trailSamples; j++) {
        const fade = Math.pow(1 - j / (trailSamples - 1), 1.65);
        fades[j * 2] = fades[j * 2 + 1] = fade;
        edges[j * 2] = -1; edges[j * 2 + 1] = 1;
        if (j < trailSamples - 1) {
          const a = j * 2, b = a + 1, c = a + 2, d = a + 3;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('aFade', new THREE.BufferAttribute(fades, 1));
      geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
      geometry.setIndex(indices);
      const color = new THREE.Color(palette[i % palette.length]);
      const trailUniforms = { uColor: { value: color }, uOpacity: { value: rand(0.22, 0.36) } };
      const trailMaterial = new THREE.ShaderMaterial({
        uniforms: trailUniforms, vertexShader: cometTrailVertexShader, fragmentShader: cometTrailFragmentShader,
        transparent: true, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: true
      });
      const ribbon = new THREE.Mesh(geometry, trailMaterial);
      ribbon.frustumCulled = false;
      ribbon.renderOrder = 3;
      ribbon.visible = false;
      scene.add(ribbon);

      const headGeometry = new THREE.BufferGeometry();
      headGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3).setUsage(THREE.DynamicDrawUsage));
      const headUniforms = {
        uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), 0.48) },
        uSize: { value: rand(1.8, 2.7) }, uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 }
      };
      const headMaterial = new THREE.ShaderMaterial({
        uniforms: headUniforms, vertexShader: cometHeadVertexShader, fragmentShader: cometHeadFragmentShader,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: true
      });
      const head = new THREE.Points(headGeometry, headMaterial);
      head.frustumCulled = false; head.renderOrder = 4; head.visible = false; scene.add(head);

      const depth = rand(-14.5, -4.2);
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (cameraZ - depth);
      const halfWidth = halfHeight * (width / Math.max(1, height));
      const lane = i % 2;
      const edgeSign = Math.random() < 0.5 ? -1 : 1;
      const across = i % 4 === 0;
      const center = new THREE.Vector2(
        across ? rand(-halfWidth * 0.12, halfWidth * 0.12) : (lane === 0 ? -1 : 1) * halfWidth * rand(0.82, 0.93),
        across ? rand(-halfHeight * 0.72, halfHeight * 0.72) : rand(-halfHeight * 0.12, halfHeight * 0.12)
      );
      const direction = across
        ? new THREE.Vector2(edgeSign, rand(-0.22, 0.22)).normalize()
        : new THREE.Vector2(rand(-0.38, 0.38), edgeSign).normalize();
      const startDistance = across ? halfWidth * 1.22 : halfHeight * 1.22;
      const endDistance = startDistance;
      const start = new THREE.Vector3(
        center.x - direction.x * startDistance,
        center.y - direction.y * startDistance,
        depth
      );
      const end = new THREE.Vector3(
        center.x + direction.x * endDistance,
        center.y + direction.y * endDistance,
        start.z + rand(-0.55, 0.55)
      );
      const distance = start.distanceTo(end);
      const speed = rand(5.5, 10);
      const travelTime = distance / speed;
      const pause = rand(1.6, 5.5);
      const cycle = travelTime + pause;
      this.comets.push({
        geometry, trailUniforms, ribbon, headGeometry, headUniforms, head, trailSamples,
        centers: new Float32Array(trailSamples * 3), start, end,
        startN: new THREE.Vector2(start.x / halfWidth, start.y / halfHeight),
        endN: new THREE.Vector2(end.x / halfWidth, end.y / halfHeight),
        baseHalfHeight: halfHeight, baseHalfWidth: halfWidth, depth,
        normal: new THREE.Vector3(-direction.y, direction.x, 0),
        curve: rand(-0.18, 0.18), baseCurve: 0, distance, speed, baseSpeed: speed, travelTime, cycle, phase: rand(0, cycle),
        tail: rand(0.8, 1.8), width: rand(0.022, 0.042), opacity: rand(0.16, 0.26),
        paletteIndex: i % palette.length
      });
      const comet = this.comets[this.comets.length - 1];
      comet.baseCurve = comet.curve;
      comet.basePhase = comet.phase;
      comet.pause = pause;
    }
    this.setViewport(width, height, cameraZ, fov);
    this.setPalette(palette);
  }

  path(comet, progress, out = this.scratch) {
    const scale = comet.halfHeight / comet.baseHalfHeight;
    const curve = Math.sin(Math.PI * progress) * comet.curve * scale;
    out.set(
      THREE.MathUtils.lerp(comet.startN.x, comet.endN.x, progress) * comet.halfWidth + comet.normal.x * curve,
      THREE.MathUtils.lerp(comet.startN.y, comet.endN.y, progress) * comet.halfHeight + comet.normal.y * curve,
      THREE.MathUtils.lerp(comet.start.z, comet.end.z, progress)
    );
    const pulseAge = Math.max(0, this.currentTime - this.pulseTime);
    if (pulseAge < 4.5 && this.pulseStrength > 0) {
      const deltaX = out.x - this.pulseCenter.x;
      const deltaY = out.y - this.pulseCenter.y;
      const distance = Math.max(0.15, Math.hypot(deltaX, deltaY));
      const kick = this.pulseStrength * pulseAge * Math.exp(-pulseAge * 1.35) * 0.18;
      out.x += deltaX / distance * kick;
      out.y += deltaY / distance * kick;
    }
    return out;
  }

  update(time) {
    this.currentTime = time;
    for (const comet of this.comets) {
      const cycleTime = (time + comet.phase) % comet.cycle;
      const active = cycleTime < comet.travelTime;
      const rawProgress = active ? cycleTime / comet.travelTime : 0;
      const progress = rawProgress + 0.018 * Math.sin(Math.PI * rawProgress);
      const fadeIn = THREE.MathUtils.smoothstep(rawProgress, 0, 0.08);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(rawProgress, 0.88, 1);
      const visibility = active ? fadeIn * fadeOut : 0;
      comet.ribbon.visible = active;
      comet.head.visible = active;
      comet.trailUniforms.uOpacity.value = comet.opacity * visibility;
      comet.headUniforms.uOpacity.value = visibility;
      const n = comet.trailSamples;
      const centers = comet.centers;
      // The trail is sampled backward along the same flight path as its head.
      for (let i = 0; i < n; i++) {
        const back = i / (n - 1) * comet.tail * (comet.halfHeight / comet.baseHalfHeight) / comet.distance;
        const p = this.path(comet, progress - back, this.scratch);
        centers[i * 3] = p.x; centers[i * 3 + 1] = p.y; centers[i * 3 + 2] = p.z;
      }
      // Then widen each center sample into a tapered ribbon facing approximately toward the camera.
      const positions = comet.geometry.getAttribute('position');
      for (let i = 0; i < n; i++) {
        const prev = Math.max(0, i - 1), next = Math.min(n - 1, i + 1);
        this.tangent.set(
          centers[next * 3] - centers[prev * 3],
          centers[next * 3 + 1] - centers[prev * 3 + 1],
          centers[next * 3 + 2] - centers[prev * 3 + 2]
        ).normalize();
        this.side.crossVectors(this.tangent, this.view);
        if (this.side.lengthSq() < 1e-5) this.side.set(1, 0, 0);
        this.side.normalize();
        const fade = Math.pow(1 - i / (n - 1), 1.65);
        const width = comet.width * (comet.halfHeight / comet.baseHalfHeight) * (0.12 + 0.88 * fade);
        const x = centers[i * 3], y = centers[i * 3 + 1], z = centers[i * 3 + 2];
        positions.setXYZ(i * 2, x - this.side.x * width, y - this.side.y * width, z - this.side.z * width);
        positions.setXYZ(i * 2 + 1, x + this.side.x * width, y + this.side.y * width, z + this.side.z * width);
      }
      positions.needsUpdate = true;

      const head = this.path(comet, progress, this.scratch);
      const hp = comet.headGeometry.getAttribute('position');
      hp.setXYZ(0, head.x, head.y, head.z); hp.needsUpdate = true;
    }
  }

  setPalette(palette) {
    this.comets.forEach((comet, i) => {
      const c = new THREE.Color(palette[i % palette.length]);
      comet.trailUniforms.uColor.value.copy(c);
      comet.headUniforms.uColor.value.copy(c).lerp(new THREE.Color('#ffffff'), 0.48);
    });
  }
  setArtDirection(direction) {
    const profile = GALAXY_PROFILES[direction?.galaxy];
    const flow = profile?.flow ?? 0;
    const directionSign = flow < 0 ? -1 : 1;
    for (const comet of this.comets) {
      if (!profile) {
        comet.curve = comet.baseCurve;
        comet.speed = comet.baseSpeed;
        comet.travelTime = comet.distance / comet.speed;
        comet.cycle = comet.travelTime + comet.pause;
        comet.phase = comet.basePhase % comet.cycle;
        continue;
      }
      comet.curve = comet.baseCurve + directionSign * profile.asymmetry * 0.48;
      comet.speed = comet.baseSpeed * THREE.MathUtils.clamp(0.78 + profile.spin * 1.3 + Math.abs(flow) * 0.8, 0.85, 1.22);
      comet.travelTime = comet.distance / comet.speed;
      comet.cycle = comet.travelTime + comet.pause;
      comet.phase = (comet.basePhase + profile.phase * 0.24) % comet.cycle;
    }
  }
  setPixelRatio(value) {
    this.comets.forEach(comet => { comet.headUniforms.uPixelRatio.value = value; });
  }
  setViewport(width, height, cameraZ = this.cameraZ, fov = this.fov) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.cameraZ = cameraZ;
    this.fov = fov;
    for (const comet of this.comets) {
      comet.halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (cameraZ - comet.depth);
      comet.halfWidth = comet.halfHeight * this.width / this.height;
      comet.distance = Math.hypot(
        (comet.endN.x - comet.startN.x) * comet.halfWidth,
        (comet.endN.y - comet.startN.y) * comet.halfHeight,
        comet.end.z - comet.start.z
      );
      comet.travelTime = comet.distance / comet.speed;
      comet.cycle = comet.travelTime + comet.pause;
      comet.phase %= comet.cycle;
    }
  }
  triggerPulse(x, y, time, strength) {
    this.pulseCenter.set(x, y);
    this.pulseTime = time;
    this.pulseStrength = strength;
  }
  dispose() {
    for (const comet of this.comets) {
      this.scene.remove(comet.ribbon, comet.head);
      comet.geometry.dispose(); comet.ribbon.material.dispose();
      comet.headGeometry.dispose(); comet.head.material.dispose();
    }
  }
}
