import { hashGalaxySeed } from '../data/galaxyProfiles.js';

const TAU = Math.PI * 2;
const GOLDEN_SPIRAL_RATE = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);
const GROUP_IDS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);
const MORPHOLOGY_WEIGHTS = Object.freeze({
  spiral:    [0.05, 0.75, 0.04, 0.04, 0.01, 0.02, 0.01, 0.08],
  ribbon:    [0.05, 0.73, 0.05, 0.05, 0.01, 0.02, 0.01, 0.08],
  bloom:     [0.07, 0.72, 0.05, 0.05, 0.01, 0.02, 0.01, 0.07],
  crystal:   [0.05, 0.74, 0.05, 0.05, 0.01, 0.02, 0.01, 0.07],
  drift:     [0.05, 0.74, 0.05, 0.04, 0.01, 0.02, 0.02, 0.07],
  harmonic:  [0.05, 0.73, 0.05, 0.05, 0.01, 0.03, 0.02, 0.06],
  botanical: [0.05, 0.74, 0.05, 0.05, 0.01, 0.02, 0.02, 0.06],
  orbital:   [0.05, 0.72, 0.06, 0.05, 0.01, 0.03, 0.03, 0.05],
  deepfield: [0.05, 0.70, 0.06, 0.05, 0.02, 0.03, 0.04, 0.05]
});
const ARM_STYLES = Object.freeze({
  grandDesign: { yScale: 0.64, turns: 0.02, warp: 0.018, extent: 1.08 },
  barred: { yScale: 0.58, turns: -0.02, warp: 0.018, extent: 1.12, bar: 0.9 },
  multiArm: { yScale: 0.62, turns: 0.06, warp: 0.035, extent: 1.13 },
  flocculent: { yScale: 0.67, turns: -0.04, warp: 0.075, extent: 1.08, fork: 0.16 },
  tight: { yScale: 0.57, turns: 0.14, warp: 0.018, extent: 1.1 },
  open: { yScale: 0.68, turns: -0.12, warp: 0.06, extent: 1.15 },
  ring: { yScale: 0.6, turns: 0.01, warp: 0.02, extent: 1.12, ring: 1.2 },
  warped: { yScale: 0.55, turns: -0.03, warp: 0.11, extent: 1.1 },
  dustyBarred: { yScale: 0.64, turns: 0.05, warp: 0.025, extent: 1.14, bar: 0.74 }
});

export const MORPHOLOGIES = Object.freeze({
  spiral: 0, ribbon: 1, bloom: 2, crystal: 3, drift: 4,
  harmonic: 5, botanical: 6, orbital: 7, deepfield: 8
});

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-7, random()))) * Math.cos(TAU * random());
}

function usesExtendedSpiral(profile) {
  return profile.shape === 'spiral' && profile.name !== 'Twin-Spiral Galaxy';
}

function getArmStyle(profile) {
  const style = ARM_STYLES[profile.armStyle] || ARM_STYLES.grandDesign;
  if (!usesExtendedSpiral(profile)) return style;
  return { ...style, yScale: profile.diskScale ?? style.yScale, bar: 0, ring: 0, fork: 0 };
}

export function createGalaxyPersonalization(seed, profile) {
  const random = seededRandom(hashGalaxySeed(`galaxy-personalization:${String(seed)}`));
  const pitchScale = 0.58 + random() * 0.84;
  const armRoll = random();
  const pitch = Math.min(0.72, Math.max(0.12, profile.pitch * pitchScale));
  const style = getArmStyle(profile);
  const spinRate = 0.82 + random() * 0.36;
  const spinDirection = random() < 0.5 ? -1 : 1;
  const rotation = usesExtendedSpiral(profile)
    ? [
      (profile.inclination + (random() - 0.5) * 2.4) * Math.PI / 180,
      (random() - 0.5) * 0.035,
      (profile.rotate + (random() - 0.5) * 3.2) * Math.PI / 180
    ]
    : profile.name === 'Twin-Spiral Galaxy'
      ? [
        (profile.inclination + (random() - 0.5) * 1.4) * Math.PI / 180,
        (random() - 0.5) * 0.025,
        (profile.rotate + (random() - 0.5) * 1.4) * Math.PI / 180
      ]
      : [
        0.14 + random() * 0.72,
        (random() - 0.5) * 0.56,
        random() * TAU
      ];
  return {
    arms: 3 + Math.floor(armRoll * 3),
    pitch,
    spiralAngleStep: TAU * (0.62 + pitch * 0.5 + (style.turns || 0)),
    spiralGrowth: GOLDEN_SPIRAL_RATE * (1.1 + pitch * 0.72),
    spinRate,
    spinDirection,
    rotation
  };
}

function spiralCenter(profile, arm, progress, phaseOffset = 0) {
  const phase = profile.phase + arm * TAU / profile.arms + phaseOffset;
  const style = getArmStyle(profile);
  const yScale = style.yScale;
  const turns = 0.62 + profile.pitch * 0.5 + style.turns;
  const angleStep = TAU * turns;
  const radialGrowth = GOLDEN_SPIRAL_RATE * (1.1 + profile.pitch * 0.72);
  const angle = phase + progress * angleStep
    + Math.sin(progress * TAU * 1.4 + phase * 0.7) * style.warp;
  const profileScale = usesExtendedSpiral(profile) ? profile.curveScale : 1;
  const radius = (style.ring ?? 0) + (style.bar ?? 0) * profile.core
    + 0.9 * style.extent * profileScale * Math.exp(radialGrowth * progress * angleStep);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * yScale * 1.12;

  return {
    x: x + profile.asymmetry * progress * 0.28,
    y: y + Math.sin(progress * TAU + phase) * style.warp * progress,
    z: Math.sin(angle * 1.5 + phase) * profile.depth * 0.25
  };
}

function spiralFrame(profile, arm, progress, phaseOffset = 0) {
  const center = spiralCenter(profile, arm, progress, phaseOffset);
  const sampleStep = 0.001;
  const before = spiralCenter(profile, arm, Math.max(0, progress - sampleStep), phaseOffset);
  const after = spiralCenter(profile, arm, Math.min(1, progress + sampleStep), phaseOffset);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const tangentLength = Math.max(1e-6, Math.hypot(dx, dy));
  return {
    ...center,
    normalX: -dy / tangentLength,
    normalY: dx / tangentLength
  };
}

function armPoint(profile, arm, progress, random, widthScale = 1) {
  const frame = spiralFrame(profile, arm, progress);
  const radius = Math.hypot(frame.x, frame.y);
  const extended = usesExtendedSpiral(profile);
  const width = (extended ? profile.armWidth : profile.thickness)
    * (0.055 + radius * 0.024)
    * (extended ? 1 + profile.flocculence * 0.5 : 1)
    * widthScale;
  const style = getArmStyle(profile);
  const fork = style.fork ? Math.sin(progress * TAU * 2.1 + arm * 1.7) * style.fork * progress : 0;
  const spine = random() < 0.68;
  const crossSection = spine ? 0.38 : 1.18;
  const normalScatter = gaussian(random) * width * crossSection + fork;
  const tangentScatter = gaussian(random) * width * crossSection * (spine ? 0.3 : 0.46);
  return [
    frame.x + frame.normalX * normalScatter - frame.normalY * tangentScatter,
    frame.y + frame.normalY * normalScatter + frame.normalX * tangentScatter,
    frame.z + gaussian(random) * profile.depth * (0.16 + radius * 0.026)
  ];
}

export function generateGalaxyPoints(count, profile, identity, seed = identity) {
  const personalization = createGalaxyPersonalization(seed, profile);
  const personalProfile = {
    ...profile,
    ...personalization,
    arms: usesExtendedSpiral(profile) ? profile.armCount : personalization.arms
  };
  const random = seededRandom(hashGalaxySeed(`${identity}:${profile.morphology}:${profile.curve}`));
  const positions = new Float32Array(count * 3);
  const groups = new Float32Array(count);
  const seeds = new Float32Array(count);
  const progressValues = new Float32Array(count);
  const arms = new Float32Array(count);
  const weights = MORPHOLOGY_WEIGHTS[profile.morphology] || MORPHOLOGY_WEIGHTS.spiral;
  const boundaries = [];
  let cursor = 0;
  for (const id of GROUP_IDS) {
    const end = id === GROUP_IDS[GROUP_IDS.length - 1]
      ? count
      : cursor + Math.floor(count * weights[id]);
    boundaries.push([id, cursor, end]);
    cursor = end;
  }

  for (const [group, start, end] of boundaries) {
    const clusterCount = 11 + (personalProfile.arms % 4);
    for (let i = start; i < end; i++) {
      const progress = random();
      const arm = Math.floor(random() * personalProfile.arms);
      let motionProgress = progress;
      let point;
      if (group === 0) {
        const style = getArmStyle(personalProfile);
        const bulgeScale = usesExtendedSpiral(personalProfile) ? personalProfile.bulgeSize : 1;
        const radius = Math.sqrt(random()) * personalProfile.core * 1.65 * bulgeScale;
        const angle = random() * TAU;
        let x = Math.cos(angle) * radius;
        let y = Math.sin(angle) * radius * 0.68;
        if (usesExtendedSpiral(personalProfile) && personalProfile.barStrength > 0) {
          const barRadius = Math.max(0.001, personalProfile.core * bulgeScale * 0.25);
          const barEnvelope = Math.max(0, 1 - radius / barRadius);
          x *= 1 + personalProfile.barStrength * 0.5 * barEnvelope;
        }
        if (style.bar) {
          x *= 1 + style.bar * 1.4;
          y *= 0.68;
          const barAngle = personalProfile.phase;
          [x, y] = [
            Math.cos(barAngle) * x - Math.sin(barAngle) * y,
            Math.sin(barAngle) * x + Math.cos(barAngle) * y
          ];
        }
        point = [x, y, gaussian(random) * 0.24];
      } else if (group === 1 || group === 5 || group === 6) {
        const widthScale = group === 5 ? 0.58 : group === 6 ? 1.5 : 1;
        if (group === 6 && personalProfile.secondaryArms > 0) {
          const secondaryProfile = {
            ...personalProfile,
            arms: personalProfile.arms + personalProfile.secondaryArms
          };
          point = armPoint(secondaryProfile, arm % secondaryProfile.arms, progress, random, widthScale);
        } else {
          point = armPoint(personalProfile, arm, progress, random, widthScale);
        }
      } else if (group === 2 || group === 3) {
        const cluster = Math.floor(random() * clusterCount);
        const clusterProgress = (cluster + 0.18 + random() * 0.64) / clusterCount;
        motionProgress = clusterProgress;
        const center = armPoint(personalProfile, cluster % personalProfile.arms, clusterProgress, random);
        const cloudScale = group === 2 ? personalProfile.clouds : personalProfile.clusters;
        const radialScale = 0.55 + Math.hypot(center[0], center[1]) * 0.1;
        point = [
          center[0] + gaussian(random) * (group === 2 ? 0.34 : 0.18) * cloudScale * radialScale,
          center[1] + gaussian(random) * (group === 2 ? 0.28 : 0.15) * cloudScale * radialScale,
          center[2] + gaussian(random) * (group === 2 ? 0.24 : 0.15) * personalProfile.depth * radialScale
        ];
      } else if (group === 4) {
        const azimuth = random() * TAU;
        const elevation = Math.acos(1 - random() * 2);
        let radius;
        if (usesExtendedSpiral(personalProfile)) {
          const layerCount = Math.max(1, Math.floor(personalProfile.haloLayers));
          const layer = Math.floor(random() * layerCount);
          const layerScale = layerCount === 1 ? 1 : 0.74 + 0.24 * layer / (layerCount - 1);
          radius = (1.2 + Math.pow(random(), 0.58) * 5.2 * personalProfile.halo) * layerScale;
        } else {
          radius = 1.2 + Math.pow(random(), 0.58) * 5.2 * personalProfile.halo;
        }
        const shell = Math.sin(elevation) * radius;
        point = [
          Math.cos(azimuth) * shell,
          Math.sin(azimuth) * shell * 0.52,
          Math.cos(elevation) * radius * 0.72 * personalProfile.depth
        ];
      } else {
        const branchProgress = 0.18 + random() * 0.68;
        motionProgress = branchProgress;
        const branchSide = random() < 0.5 ? -1 : 1;
        const branchOffset = branchSide * (0.16 + branchProgress * 0.24);
        const frame = spiralFrame(personalProfile, arm, branchProgress, branchOffset);
        const branchLength = (0.1 + random() * 0.28) * personalProfile.thickness;
        const offset = gaussian(random) * personalProfile.thickness * 0.08;
        point = [
          frame.x + frame.normalX * (branchLength * branchSide + offset),
          frame.y + frame.normalY * (branchLength * branchSide + offset),
          frame.z + gaussian(random) * 0.12 * personalProfile.depth
        ];
      }
      positions.set(point, i * 3);
      groups[i] = group;
      seeds[i] = random();
      progressValues[i] = motionProgress;
      arms[i] = arm;
    }
  }
  return { positions, groups, seeds, progress: progressValues, arms, personalization };
}
