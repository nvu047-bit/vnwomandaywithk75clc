// Pure layout + graph helpers for the shared galaxy. No rendering dependencies,
// so the same code is exercised by Node tests and by the WebGL renderer.

export const SHARED_CAMERA = Object.freeze({ fov: 42, z: 34, near: 0.5, far: 320 });
/** Radius (in a galaxy's local units) that contains its visible matter. */
export const LOCAL_RADIUS = 7.2;

// Normalised placement inside the visible frustum at the galaxy's own depth:
// [x, y, worldZ, sizeMultiplier]. Intentionally irregular — near, middle and far
// galaxies overlap in depth rather than forming a flat grid or nine equal icons.
export const DESKTOP_LAYOUT = Object.freeze([
  [-0.70, 0.46, -3, 1.00],   // 0  Kiều Châm
  [-0.16, 0.68, -9, 0.92],   // 1  Thùy Dung
  [0.58, 0.52, 3, 1.12],     // 2  Ngọc Lan
  [0.90, -0.04, -6, 0.88],   // 3  Khánh Linh
  [0.40, -0.58, 1, 1.06],    // 4  Phương
  [-0.10, -0.50, -11, 0.90], // 5  Thanh Tâm
  [-0.58, -0.54, 5, 1.14],   // 6  Phương Thảo
  [-0.92, 0.00, -8, 0.90],   // 7  Thùy Trang
  [0.14, 0.04, -3, 1.00]     // 8  Huyền Trang
]);

export const MOBILE_LAYOUT = Object.freeze([
  [0.00, 0.00, -3, 1.00],
  [1.50, 0.00, -9, 0.92],
  [3.00, 0.00, 3, 1.12],
  [0.00, -1.50, -6, 0.90],
  [1.50, -1.50, 1, 1.04],
  [3.00, -1.50, -11, 0.92],
  [0.00, -3.00, 5, 1.12],
  [1.50, -3.00, -8, 0.92],
  [3.00, -3.00, -3, 1.00]
]);

export function halfExtentsAt(depthZ, aspect, camera = SHARED_CAMERA) {
  const halfH = Math.tan(camera.fov * Math.PI / 360) * (camera.z - depthZ);
  return { halfW: halfH * aspect, halfH };
}

/** World-space placement for all galaxies at a given aspect ratio. */
export function computeLayout({ aspect, mobile, camera = SHARED_CAMERA }) {
  // `mobile` here means portrait orientation (tall, narrow viewport).
  const table = mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
  const ref = halfExtentsAt(0, aspect, camera);
  // Fixed world size (perspective then makes near galaxies larger than far ones).
  const unit = mobile
    ? Math.min(ref.halfH * 0.28, ref.halfW * 0.33)
    : Math.min(ref.halfH * 0.31, ref.halfW * 0.29);
  return table.map(([nx, ny, z, size]) => {
    const { halfW, halfH } = halfExtentsAt(z, aspect, camera);
    const radius = unit * size;
    return {
      x: nx * halfW * 0.86, y: ny * halfH * 0.86, z,
      radius, scale: radius / LOCAL_RADIUS, size,
      nx, ny
    };
  });
}

/**
 * Connect each galaxy to its two nearest neighbours (aspect-corrected), then add
 * the shortest bridges needed to make the whole graph connected. Deterministic.
 */
export function buildBridgeGraph(points, aspect = 1.6, neighbours = 2) {
  const n = points.length;
  const flat = points.map(p => [p.nx * aspect, p.ny]);
  const dist = (a, b) => Math.hypot(flat[a][0] - flat[b][0], flat[a][1] - flat[b][1]);
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seen = new Set();
  const edges = [];
  const add = (a, b) => {
    const k = key(a, b);
    if (a === b || seen.has(k)) return false;
    seen.add(k);
    edges.push(a < b ? [a, b] : [b, a]);
    return true;
  };
  for (let i = 0; i < n; i++) {
    const order = [...Array(n).keys()].filter(j => j !== i).sort((a, b) => dist(i, a) - dist(i, b));
    for (let k = 0; k < neighbours; k++) add(i, order[k]);
  }
  const parent = [...Array(n).keys()];
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of edges) parent[find(a)] = find(b);
  for (;;) {
    let best = null;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      if (find(a) === find(b)) continue;
      const d = dist(a, b);
      if (!best || d < best.d) best = { a, b, d };
    }
    if (!best) break;
    add(best.a, best.b);
    parent[find(best.a)] = find(best.b);
  }
  return edges;
}

export function neighboursOf(edges, node) {
  const out = [];
  edges.forEach(([a, b], index) => {
    if (a === node) out.push({ edge: index, other: b });
    else if (b === node) out.push({ edge: index, other: a });
  });
  return out;
}
