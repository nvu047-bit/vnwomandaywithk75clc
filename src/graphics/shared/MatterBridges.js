import * as THREE from 'three';
import {
  MAX_BRIDGES, bridgeVertexShader, bridgeFragmentShader
} from './sharedShaders.js';

const smooth = x => x * x * (3 - 2 * x);

/**
 * Curved streams of matter between galaxies. Every particle is advected along a
 * cubic Bézier in the vertex shader (position is a function of uTime), the curve's
 * control points breathe, and energy pulses can be sent down any bridge.
 */
export class MatterBridges {
  constructor(scene, { pixelRatio, mobile }) {
    this.scene = scene;
    this.mobile = mobile;
    this.perEdge = mobile ? 160 : 250;
    this.edges = [];
    this.pulses = Array.from({ length: MAX_BRIDGES }, () => ({
      active: false, t0: 0, duration: 1, dir: 1, amp: 1, onArrive: null
    }));
    this.uniforms = {
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uSizeScale: { value: 1 },
      uWobble: { value: 0.55 },
      uCurve: { value: Array.from({ length: MAX_BRIDGES * 4 }, () => new THREE.Vector3()) },
      uColA: { value: Array.from({ length: MAX_BRIDGES }, () => new THREE.Color()) },
      uColB: { value: Array.from({ length: MAX_BRIDGES }, () => new THREE.Color()) },
      uPulse: { value: Array.from({ length: MAX_BRIDGES }, () => new THREE.Vector2(-1, 0)) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: bridgeVertexShader, fragmentShader: bridgeFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: true
    });
    this.points = null;
    this.geometry = null;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._perp = new THREE.Vector3();
  }

  /** (Re)build curves and particle attributes for a galaxy graph and layout. */
  configure(edges, galaxies, renderOrder = 6) {
    this.edges = edges.slice(0, MAX_BRIDGES);
    const count = this.edges.length * this.perEdge;
    if (!this.geometry || this.geometry.userData.count !== count) {
      this.geometry?.dispose();
      if (this.points) this.scene.remove(this.points);
      const aEdge = new Float32Array(count);
      const aT = new Float32Array(count);
      const aSeed = new Float32Array(count);
      const aLane = new Float32Array(count);
      const aKind = new Float32Array(count);
      let state = 0x9e3779b9;
      const rnd = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      for (let e = 0, i = 0; e < this.edges.length; e++) {
        for (let k = 0; k < this.perEdge; k++, i++) {
          aEdge[i] = e;
          aT[i] = (k + rnd() * 0.9) / this.perEdge;
          aSeed[i] = rnd();
          aLane[i] = (rnd() + rnd() + rnd() - 1.5) * 1.35;
          aKind[i] = rnd() < 0.24 ? 1 : 0;
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute('aEdge', new THREE.BufferAttribute(aEdge, 1));
      geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
      geometry.setAttribute('aLane', new THREE.BufferAttribute(aLane, 1));
      geometry.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
      geometry.userData.count = count;
      this.geometry = geometry;
      this.points = new THREE.Points(geometry, this.material);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }
    this.points.renderOrder = renderOrder;

    const curves = this.uniforms.uCurve.value;
    this.edges.forEach(([a, b], e) => {
      const ga = galaxies[a], gb = galaxies[b];
      this._dir.subVectors(gb.center, ga.center);
      const length = this._dir.length();
      this._dir.divideScalar(Math.max(length, 1e-3));
      // Start/end on the galaxies' rims instead of their cores.
      this._a.copy(ga.center).addScaledVector(this._dir, ga.worldRadius * 0.55);
      this._b.copy(gb.center).addScaledVector(this._dir, -gb.worldRadius * 0.55);
      const span = this._a.distanceTo(this._b);
      this._perp.set(-this._dir.y, this._dir.x, 0);
      const bend = span * (0.18 + 0.12 * ((e * 0.618) % 1)) * (e % 2 ? 1 : -1);
      const lift = (e % 3 - 1) * span * 0.10;
      const base = e * 4;
      curves[base].copy(this._a);
      curves[base + 1].copy(this._a).lerp(this._b, 0.32).addScaledVector(this._perp, bend).setZ(this._a.z + lift);
      curves[base + 2].copy(this._a).lerp(this._b, 0.68).addScaledVector(this._perp, -bend * 0.6).setZ(this._b.z - lift);
      curves[base + 3].copy(this._b);
      this.uniforms.uColA.value[e].copy(ga.paletteA).lerp(ga.uniforms.uColorB.value, 0.35);
      this.uniforms.uColB.value[e].copy(gb.paletteA).lerp(gb.uniforms.uColorB.value, 0.35);
      this.uniforms.uPulse.value[e].set(-1, 0);
      this.pulses[e].active = false;
    });
  }

  /** Send an energy pulse down bridge `edge`, leaving from galaxy `fromNode`. */
  sendPulse(edge, fromNode, now, duration = 1.5, amp = 1, onArrive = null) {
    const spec = this.edges[edge];
    if (!spec) return false;
    const pulse = this.pulses[edge];
    pulse.active = true;
    pulse.t0 = now;
    pulse.duration = duration;
    pulse.dir = spec[0] === fromNode ? 1 : -1;
    pulse.amp = amp;
    pulse.onArrive = onArrive;
    return true;
  }

  update(time, elapsedForPulses) {
    this.uniforms.uTime.value = time;
    for (let e = 0; e < this.edges.length; e++) {
      const pulse = this.pulses[e];
      const slot = this.uniforms.uPulse.value[e];
      if (!pulse.active) { slot.set(-1, 0); continue; }
      const u = (elapsedForPulses - pulse.t0) / pulse.duration;
      if (u >= 1) {
        pulse.active = false;
        slot.set(-1, 0);
        const callback = pulse.onArrive;
        pulse.onArrive = null;
        callback?.();
        continue;
      }
      const s = smooth(Math.max(0, u));
      slot.set(pulse.dir > 0 ? s : 1 - s, pulse.amp * Math.sin(Math.PI * Math.min(1, u)) ** 0.6);
    }
  }

  get activePulseCount() { return this.pulses.reduce((n, p) => n + (p.active ? 1 : 0), 0); }

  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value; }

  dispose() {
    if (this.points) this.scene.remove(this.points);
    this.geometry?.dispose();
    this.material.dispose();
  }
}
