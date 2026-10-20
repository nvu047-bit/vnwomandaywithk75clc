import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ParticleCloud } from '../src/graphics/ParticleCloud.js';

// The Canvas mock exercises CPU-side sampling/ownership only; it does not claim
// to verify shader compilation or the final browser pixels.
function makeCanvas(width, height) {
  let pixels = new Uint8ClampedArray(0);
  const canvas = {
    width,
    height,
    getContext() {
      pixels = new Uint8ClampedArray(this.width * this.height * 4);
      return {
        font: '',
        textAlign: 'left',
        textBaseline: 'middle',
        fillStyle: '#fff',
        clearRect() { pixels.fill(0); },
        measureText(text) { return { width: String(text).length * 104 }; },
        fillText(_text, x, y) {
          const left = Math.max(0, Math.floor(x + 4));
          const right = Math.min(thisCanvas.width, Math.ceil(x + 92));
          const top = Math.max(0, Math.floor(y - 105));
          const bottom = Math.min(thisCanvas.height, Math.ceil(y + 38));
          for (let py = top; py < bottom; py++) {
            for (let px = left; px < right; px++) pixels[(py * thisCanvas.width + px) * 4 + 3] = 255;
          }
        },
        getImageData() { return { data: pixels }; }
      };
    }
  };
  const thisCanvas = canvas;
  return canvas;
}

globalThis.document = { createElement: tag => {
  assert.equal(tag, 'canvas');
  return makeCanvas(1, 1);
} };
globalThis.window = { innerWidth: 1280, innerHeight: 800 };

const sceneObjects = new Set();
const scene = {
  add(object) { sceneObjects.add(object); },
  remove(object) { sceneObjects.delete(object); }
};
const cloud = new ParticleCloud(scene, { count: 110, pixelRatio: 1 });

try {
  assert.equal(sceneObjects.size, 1, 'Morphic owns exactly one THREE.Points render object');
  assert.equal(cloud.glowPoints, undefined, 'there is no second Points object capable of ghosting the glyph');
  assert.equal(cloud.glowGeometry, undefined, 'no duplicate/indexed morph geometry is allocated');
  assert.equal(cloud.points.material.toneMapped, false, 'foreground morph stays linear until the final OutputPass');
  assert.equal(cloud.points.renderOrder, 100, 'Morphic stays at the top of its isolated identity scene');

  for (const name of ['position', 'aHNUE', 'aSMCS', 'aK75', 'aRecipient', 'aPreviousRecipient', 'aDirection', 'aSeed', 'aOrbit']) {
    const attribute = cloud.geometry.getAttribute(name);
    assert.ok(attribute, `${name} attribute exists on the canonical geometry`);
    assert.equal(attribute.count, cloud.count, `${name} uses the canonical particle count`);
  }
  assert.equal(cloud.uniforms.uGlowLayer, undefined, 'no second-layer alpha path exists in the uniforms');
  const uniqueSamples = new Set();
  for (const name of ['aHNUE', 'aSMCS', 'aK75']) {
    const samples = cloud.geometry.getAttribute(name).array;
    for (let i = 0; i < samples.length; i += 3) {
      if (name === 'aHNUE') uniqueSamples.add(`${samples[i].toFixed(4)},${samples[i + 1].toFixed(4)}`);
    }
  }
  assert.ok(uniqueSamples.size >= cloud.count * 0.9, 'glyph sampling avoids heavy duplicated raster coordinates');

  cloud.setRecipient('KIEU CHAM', { seed: 0.31 });
  assert.equal(cloud.geometry.getAttribute('aRecipient').count, cloud.count, 'recipient morph updates canonical target only');
  cloud.resetRecipientTransition();
  assert.equal(cloud.uniforms.uRecipientTransition.value, 1, 'recipient reset leaves a fully settled target');

  const timelines = [];
  const fakeGsap = {
    timeline(options) {
      const timeline = {
        options,
        killed: false,
        fromTo(target, fromVars, toVars) {
          this.target = target;
          this.fromVars = fromVars;
          this.toVars = toVars;
          return this;
        },
        kill() { this.killed = true; }
      };
      timelines.push(timeline);
      return timeline;
    }
  };
  cloud.startIdleMorph(fakeGsap);
  assert.equal(timelines.length, 1, 'one timeline owns HNUE → SMCS → K75CLC');
  assert.equal(timelines[0].target, cloud.uniforms.uMorph, 'the timeline animates the only render object');
  assert.equal(timelines[0].toVars.duration, 4, 'the staged infinity morph completes in four seconds');
  assert.equal(timelines[0].toVars.ease, 'power3.inOut', 'the morph eases smoothly at both endpoints');
  cloud.startIdleMorph(fakeGsap);
  assert.equal(timelines.length, 2, 'restarting idle mode creates one replacement timeline');
  assert.equal(timelines[0].killed, true, 'the previous timeline is killed before replacement');

  const sceneSource = await readFile(new URL('../src/graphics/StellarScene.js', import.meta.url), 'utf8');
  const shaderSource = await readFile(new URL('../src/graphics/shaders.js', import.meta.url), 'utf8');
  const particleSource = await readFile(new URL('../src/graphics/ParticleCloud.js', import.meta.url), 'utf8');
  const particleShader = shaderSource.slice(shaderSource.indexOf('export const particleVertexShader'), shaderSource.indexOf('export const starVertexShader'));
  assert.match(sceneSource, /new ParticleCloud\(this\.identityScene/);
  assert.match(sceneSource, /this\.composer\.addPass\(this\.bloomPass\);[\s\S]*this\.composer\.addPass\(this\.identityPass\);[\s\S]*this\.composer\.addPass\(this\.outputPass\);/,
    'identity pass is rendered after bloom and before output color conversion');
  assert.match(particleShader, /const float signatureTilt = -0\.5235988;[\s\S]*fromShape\.xy = rotatePoint\(fromShape\.xy, signatureTilt\);[\s\S]*toShape\.xy = rotatePoint\(toShape\.xy, signatureTilt\);/,
    'all signature marks share a leftward 30-degree tilt');
  assert.match(particleSource, /const signatureTilt = -Math\.PI \/ 6;[\s\S]*signatureHalfWidth \* tiltCos \+ signatureHalfHeight \* tiltSin/,
    'title protection bounds include the rotated signature footprint');
  assert.match(particleShader, /float morphProgress = smoothstep\(0\.0, 1\.0, uMorph\);/,
    'all particles share one morph progress so old and new glyph silhouettes do not coexist');
  assert.match(particleShader, /float infinityAngle = aOrbit \* 6\.2831853 \+ uTime \* 4\.2;[\s\S]*float gatherProgress = smoothstep\(0\.0, 0\.4, uMorph\);[\s\S]*float leaveProgress = smoothstep\(0\.68, 1\.0, uMorph\);[\s\S]*float leaveInfinity = step\(0\.68, uMorph\);[\s\S]*vec3 p = mix\(gatheredShape, departingShape, leaveInfinity\);[\s\S]*p \+= gatherFlow \* gatherArc[\s\S]*\+ leaveFlow \* leaveArc/,
    'particles gradually gather into infinity, keep orbiting during a short transition interlude, then reform the next glyph');
  assert.match(particleShader, /3\.0 \* sin\(infinityAngle\) \/ infinityDenominator,[\s\S]*2\.0 \* sin\(infinityAngle\) \* infinityCos \/ infinityDenominator[\s\S]*vec2 infinityTangent = normalize\(infinityNext - infinityShape\.xy\);[\s\S]*infinityShape\.xy \+= vec2\(-infinityTangent\.y, infinityTangent\.x\) \* \(\(aSeed - 0\.5\) \* 0\.36\);[\s\S]*infinityShape\.xy = rotatePoint\(infinityShape\.xy, signatureTilt\);[\s\S]*p\.y \+= 1\.6 \* \(1\.0 - recipientT\);/,
    'the text-scale infinity has a gently thickened particle band and shares the signature tilt and vertical center');
  const orbit = cloud.geometry.getAttribute('aOrbit').array;
  assert.ok(Math.abs(orbit[0] - 0.5 / cloud.count) < 1e-7 && Math.abs(orbit[cloud.count - 1] - (cloud.count - 0.5) / cloud.count) < 1e-7,
    'infinity targets are distributed evenly around the loop');
  assert.match(particleShader, /vColor = mix\(vColor, vec3\(1\.0, 0\.91, 0\.82\), morphArc \* \(1\.0 - recipientT\) \* 0\.16\);[\s\S]*vAlpha \*= 1\.0 \+ morphArc \* \(1\.0 - recipientT\) \* 0\.035;/,
    'particles get a restrained warm glint as they travel between glyphs');
  assert.doesNotMatch(particleShader, /morphStart|morphEnd/,
    'particle-specific timing does not leave a ghost of the previous glyph');
  assert.doesNotMatch(particleShader, /collapseVisibility|vortexCore|vortexBlend/,
    'the idle morph does not create a collapsed or duplicated glyph layer');
  assert.doesNotMatch(particleShader, /uGlowLayer/,
    'particle shader has no alternate ghost-layer path');

  console.log('Morphic regression test passed: one mesh, unique glyph samples, shared canonical targets, single timeline, and post-bloom identity pass ordering. GPU/browser pixels are not covered by this Node test.');
} finally {
  cloud.dispose();
  assert.equal(sceneObjects.size, 0, 'disposing the cloud removes the only render object');
  delete globalThis.document;
  delete globalThis.window;
}
