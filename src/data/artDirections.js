const directions = {
  '755101034': {
    concept: 'Rose Nebula',
    galaxy: 'twinSpiral',
    style: 0,
    seed: 0.13,
    aspect: [0.92, 1.18],
    core: [-0.16, 0.08],
    flow: -0.24,
    warp: 0.66,
    density: 0.92,
    colorWeights: [0.55, 0.30, 0.15],
    motion: 0.62,
    reveal: { burst: 0.72, settle: 0.92, cameraZ: 7.0, textDelay: 0.42, panelOffset: -72 }
  },
  '755101050': {
    concept: 'Lemniscate Veil',
    galaxy: 'ribbon',
    style: 1,
    seed: 0.27,
    aspect: [1.02, 0.94],
    core: [0.18, -0.06],
    flow: 0.58,
    warp: 0.54,
    density: 0.84,
    colorWeights: [0.30, 0.48, 0.22],
    motion: 0.44,
    reveal: { burst: 0.60, settle: 1.04, cameraZ: 7.5, textDelay: 0.50, panelOffset: 66 }
  },
  '755101145': {
    concept: 'Golden Phyllotaxis',
    galaxy: 'stellarBloom',
    style: 2,
    seed: 0.39,
    aspect: [0.92, 1.12],
    core: [-0.08, 0.16],
    flow: 1.02,
    warp: 0.72,
    density: 0.86,
    colorWeights: [0.44, 0.26, 0.30],
    motion: 0.58,
    reveal: { burst: 0.68, settle: 0.96, cameraZ: 6.8, textDelay: 0.46, panelOffset: 0 }
  },
  '755101154': {
    concept: 'Opal Orbit',
    galaxy: 'crystalSpiral',
    style: 3,
    seed: 0.48,
    aspect: [1.2, 0.82],
    core: [0.22, 0.08],
    flow: -0.78,
    warp: 0.48,
    density: 0.78,
    colorWeights: [0.28, 0.42, 0.30],
    motion: 0.38,
    reveal: { burst: 0.56, settle: 1.12, cameraZ: 7.8, textDelay: 0.52, panelOffset: -62 }
  },
  '755101222': {
    concept: 'Prism Bloom',
    galaxy: 'celestialDrift',
    style: 4,
    seed: 0.57,
    aspect: [1.06, 0.92],
    core: [-0.2, -0.1],
    flow: 0.38,
    warp: 0.74,
    density: 0.88,
    colorWeights: [0.37, 0.32, 0.31],
    motion: 0.67,
    reveal: { burst: 0.78, settle: 0.90, cameraZ: 6.6, textDelay: 0.40, panelOffset: 72 }
  },
  '755101245': {
    concept: 'Prism Tide',
    galaxy: 'harmonic',
    style: 5,
    seed: 0.66,
    aspect: [1.28, 0.78],
    core: [0.12, 0.18],
    flow: 1.36,
    warp: 0.58,
    density: 0.82,
    colorWeights: [0.27, 0.38, 0.35],
    motion: 0.72,
    reveal: { burst: 0.64, settle: 1.00, cameraZ: 7.3, textDelay: 0.48, panelOffset: 0 }
  },
  '755101253': {
    concept: 'Violet Spiral',
    galaxy: 'botanical',
    style: 6,
    seed: 0.74,
    aspect: [0.94, 1.14],
    core: [-0.18, 0.02],
    flow: -1.12,
    warp: 0.78,
    density: 0.9,
    colorWeights: [0.45, 0.35, 0.20],
    motion: 0.78,
    reveal: { burst: 0.75, settle: 0.94, cameraZ: 6.9, textDelay: 0.44, panelOffset: -68 }
  },
  '755101276': {
    concept: 'Velvet Epicycle',
    galaxy: 'orbitalAtelier',
    style: 7,
    seed: 0.83,
    aspect: [1.12, 0.9],
    core: [0.1, -0.16],
    flow: 0.84,
    warp: 0.63,
    density: 0.86,
    colorWeights: [0.46, 0.28, 0.26],
    motion: 0.56,
    reveal: { burst: 0.70, settle: 1.02, cameraZ: 7.1, textDelay: 0.47, panelOffset: 70 }
  },
  '755101277': {
    concept: 'Quiet Butterfly',
    galaxy: 'etherealDeepfield',
    style: 8,
    seed: 0.92,
    aspect: [1.04, 0.98],
    core: [0.04, 0.04],
    flow: -0.48,
    warp: 0.5,
    density: 0.76,
    colorWeights: [0.32, 0.32, 0.36],
    motion: 0.34,
    reveal: { burst: 0.50, settle: 1.16, cameraZ: 8.0, textDelay: 0.54, panelOffset: 0 }
  }
};

export const recipientArtDirections = Object.freeze(directions);

export function getRecipientArtDirection(recipient) {
  const direction = recipientArtDirections[recipient?.id];
  if (!direction) throw new Error(`Missing art direction for recipient ${recipient?.id ?? '(unknown)'}`);
  return direction;
}
