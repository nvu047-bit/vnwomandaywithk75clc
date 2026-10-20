export const GALAXY_PROFILES = Object.freeze({
  twinSpiral: Object.freeze({
    name: 'Twin-Spiral Galaxy', morphology: 'spiral', curve: 'lemniscate',
    shape: 'spiral', armCount: 2, armWidth: 0.62, flocculence: 0.1,
    barStrength: 0, bulgeSize: 1, inclination: 22, rotate: 0,
    haloLayers: 1, nebulaOpacity: 0.68, secondaryArms: 0,
    armStyle: 'grandDesign',
    arms: 2, pitch: 0.39, thickness: 0.62, asymmetry: 0.13, core: 0.62,
    halo: 0.88, clouds: 0.9, clusters: 1.08, spin: 0.19, flow: 0.11, pulse: 0.8,
    phase: 0.28, depth: 1.0, curveScale: 0.92
  }),
  ribbon: Object.freeze({
    name: 'Ribbon Galaxy', morphology: 'ribbon', curve: 'trochoid',
    shape: 'spiral', armCount: 2, armWidth: 2.5, diskScale: 1.08, flocculence: 0.55,
    barStrength: 0, bulgeSize: 0.82, inclination: 28, rotate: 6,
    haloLayers: 2, nebulaOpacity: 0.72, secondaryArms: 0,
    armStyle: 'barred',
    arms: 2, pitch: 0.48, thickness: 1.05, asymmetry: 0.03, core: 0.45,
    halo: 0.72, clouds: 1.18, clusters: 0.82, spin: 0.12, flow: 0.18, pulse: 0.55,
    phase: 1.08, depth: 1.22, curveScale: 1.15
  }),
  stellarBloom: Object.freeze({
    name: 'Stellar Bloom', morphology: 'bloom', curve: 'rose',
    shape: 'spiral', armCount: 4, armWidth: 0.72, flocculence: 0.55,
    barStrength: 0, bulgeSize: 0.9, inclination: 18, rotate: -5,
    haloLayers: 2, nebulaOpacity: 0.82, secondaryArms: 0,
    armStyle: 'multiArm',
    arms: 4, pitch: 0.25, thickness: 0.72, asymmetry: 0.02, core: 0.76,
    halo: 0.72, clouds: 1.0, clusters: 1.24, spin: 0.17, flow: 0.14, pulse: 0.98,
    phase: 0.66, depth: 0.92, curveScale: 1.68
  }),
  crystalSpiral: Object.freeze({
    name: 'Crystal Spiral', morphology: 'crystal', curve: 'superformula',
    shape: 'spiral', armCount: 2, armWidth: 0.48, diskScale: 0.54, flocculence: 0.25,
    barStrength: 0, bulgeSize: 0.78, inclination: 25, rotate: 2,
    haloLayers: 2, nebulaOpacity: 0.78, secondaryArms: 2,
    armStyle: 'tight',
    arms: 2, pitch: 0.28, thickness: 0.48, asymmetry: 0.015, core: 0.58,
    halo: 0.65, clouds: 0.72, clusters: 1.32, spin: 0.105, flow: 0.08, pulse: 0.62,
    phase: 0.43, depth: 0.9, curveScale: 1.98
  }),
  celestialDrift: Object.freeze({
    name: 'Celestial Drift', morphology: 'drift', curve: 'logSpiral',
    shape: 'spiral', armCount: 2, armWidth: 0.88, diskScale: 1.25, flocculence: 0.18,
    barStrength: 0.4, bulgeSize: 1.08, inclination: 20, rotate: -8,
    haloLayers: 2, nebulaOpacity: 0.74, secondaryArms: 0,
    armStyle: 'open',
    arms: 2, pitch: 0.51, thickness: 0.96, asymmetry: 0.025, core: 0.52,
    halo: 0.82, clouds: 1.1, clusters: 0.86, spin: 0.155, flow: 0.26, pulse: 1.12,
    phase: 1.48, depth: 1.28, curveScale: 0.67
  }),
  harmonic: Object.freeze({
    name: 'Harmonic Galaxy', morphology: 'harmonic', curve: 'lissajous',
    shape: 'spiral', armCount: 3, armWidth: 0.54, diskScale: 0.78, flocculence: 0.2,
    barStrength: 0, bulgeSize: 1.4, inclination: 30, rotate: 4,
    haloLayers: 2, nebulaOpacity: 0.82, secondaryArms: 0,
    armStyle: 'ring',
    arms: 3, pitch: 0.39, thickness: 0.56, asymmetry: 0.01, core: 0.72,
    halo: 0.8, clouds: 0.76, clusters: 1.02, spin: 0.085, flow: 0.12, pulse: 0.72,
    phase: 0.12, depth: 0.76, curveScale: 0.9
  }),
  botanical: Object.freeze({
    name: 'Botanical Nebula', morphology: 'botanical', curve: 'phyllotaxis',
    shape: 'spiral', armCount: 2, armWidth: 0.8, diskScale: 0.385, flocculence: 0.05,
    barStrength: 0, bulgeSize: 0.9, inclination: 15, rotate: 0,
    haloLayers: 1, nebulaOpacity: 0.64, secondaryArms: 0,
    armStyle: 'flocculent',
    arms: 2, pitch: 0.43, thickness: 0.8, asymmetry: 0.01, core: 0.54,
    halo: 0.76, clouds: 1.24, clusters: 1.0, spin: 0.13, flow: 0.17, pulse: 0.74,
    phase: 0.84, depth: 1.02, curveScale: 2.75
  }),
  orbitalAtelier: Object.freeze({
    name: 'Orbital Atelier', morphology: 'orbital', curve: 'epicycle',
    shape: 'spiral', armCount: 5, armWidth: 0.52, diskScale: 0.62, flocculence: 0.3,
    barStrength: 0, bulgeSize: 0.86, inclination: 24, rotate: 10,
    haloLayers: 3, nebulaOpacity: 0.76, secondaryArms: 0,
    armStyle: 'warped',
    arms: 5, pitch: 0.2, thickness: 0.66, asymmetry: 0.015, core: 0.66,
    halo: 0.68, clouds: 0.8, clusters: 0.96, spin: 0.14, flow: 0.13, pulse: 0.66,
    phase: 1.84, depth: 1.38, curveScale: 2.28
  }),
  etherealDeepfield: Object.freeze({
    name: 'Ethereal Deepfield', morphology: 'deepfield', curve: 'butterfly',
    shape: 'spiral', armCount: 2, armWidth: 0.86, diskScale: 0.58, flocculence: 0.24,
    barStrength: 0, bulgeSize: 0.82, inclination: 26, rotate: -6,
    haloLayers: 3, nebulaOpacity: 0.96, secondaryArms: 0,
    armStyle: 'dustyBarred',
    arms: 2, pitch: 0.48, thickness: 0.88, asymmetry: 0.015, core: 0.5,
    halo: 1.04, clouds: 1.34, clusters: 0.9, spin: 0.075, flow: 0.07, pulse: 0.48,
    phase: 2.28, depth: 1.48, curveScale: 1.35
  })
});

export const RECIPIENT_GALAXY_PROFILES = Object.freeze({
  '755101034': 'twinSpiral',
  '755101050': 'ribbon',
  '755101145': 'stellarBloom',
  '755101154': 'crystalSpiral',
  '755101222': 'celestialDrift',
  '755101245': 'harmonic',
  '755101253': 'botanical',
  '755101276': 'orbitalAtelier',
  '755101277': 'etherealDeepfield'
});

export function hashGalaxySeed(identity) {
  const value = String(identity ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN');
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}
