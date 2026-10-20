import * as THREE from 'three';

const planetVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const planetFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uOpacity;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(vec3(-0.42, 0.52, 0.74));
  float lambert = max(dot(normal, light), 0.0);
  float bands = 0.5 + 0.5 * sin(vUv.y * 45.0 + sin(vUv.x * 9.0 + uTime * 0.08) * 1.2);
  vec3 surface = mix(uColorA, uColorB, smoothstep(0.12, 0.9, vUv.y + (bands - 0.5) * 0.15));
  float rim = pow(1.0 - max(normal.z, 0.0), 2.4);
  vec3 color = surface * (0.16 + lambert * 0.68) + uColorB * rim * 0.24;
  gl_FragColor = vec4(color, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class CosmicBodies {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.active = false;
    this.bodies = [0, 1].map(index => {
      const group = new THREE.Group();
      const uniforms = {
        uColorA: { value: new THREE.Color('#ae96ff') },
        uColorB: { value: new THREE.Color('#87e8ff') },
        uTime: { value: 0 },
        uOpacity: { value: index === 0 ? 0.76 : 0.56 }
      };
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 24),
        new THREE.ShaderMaterial({
          uniforms, vertexShader: planetVertexShader, fragmentShader: planetFragmentShader,
          transparent: true, depthWrite: false, toneMapped: true
        })
      );
      planet.scale.setScalar(index === 0 ? 0.54 : 0.27);
      planet.renderOrder = 1;
      group.add(planet);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(index === 0 ? 0.78 : 0.4, index === 0 ? 0.012 : 0.008, 6, 72),
        new THREE.MeshBasicMaterial({
          color: '#e5d8ff', transparent: true, opacity: index === 0 ? 0.28 : 0.18,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true
        })
      );
      ring.rotation.set(1.18, 0.16, -0.22);
      ring.visible = false;
      ring.renderOrder = 1;
      group.add(ring);
      group.visible = false;
      group.position.z = -32;
      group.userData = { uniforms, planet, ring, index };
      scene.add(group);
      return group;
    });
  }

  setRecipient(recipient, direction) {
    this.active = Boolean(recipient);
    if (!recipient || !direction) {
      this.bodies.forEach(body => { body.visible = false; });
      return;
    }
    this.bodies.forEach((body, index) => {
      const { uniforms, ring } = body.userData;
      const colors = recipient.palette;
      uniforms.uColorA.value.set(colors[index % colors.length]);
      uniforms.uColorB.value.set(colors[(index + 1) % colors.length]);
      ring.material.color.set(colors[(index + 2) % colors.length]);
      ring.visible = index === 0 ? direction.style % 3 !== 1 : direction.style % 3 === 2;
      body.visible = true;
    });
  }

  update(time, cameraZ, aspect, fov = 43) {
    if (!this.active) return;
    this.time = time;
    const tangent = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    this.bodies.forEach((body, index) => {
      const { uniforms, planet, ring } = body.userData;
      uniforms.uTime.value = time;
      const phase = index * 0.54;
      const depth = -14 + Math.sin(time * 0.085 + phase * 2.4) * 6.2;
      const halfHeight = tangent * (cameraZ - depth);
      const side = index === 0 ? -1 : 1;
      const vertical = index === 0 ? 1 : -1;
      body.position.set(
        side * halfHeight * aspect * (0.84 + Math.sin(time * 0.18 + phase) * 0.025),
        vertical * halfHeight * (0.66 + Math.cos(time * 0.14 + phase) * 0.025),
        depth
      );
      body.rotation.y = Math.sin(time * 0.12 + phase) * 0.18;
      planet.rotation.y = time * (index === 0 ? 0.08 : -0.11);
      ring.rotation.z = time * (index === 0 ? 0.035 : -0.045);
    });
  }

  dispose() {
    this.bodies.forEach(body => {
      this.scene.remove(body);
      body.traverse(object => {
        object.geometry?.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    });
    this.bodies.length = 0;
  }
}
