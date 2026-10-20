import assert from 'node:assert/strict';
import { recipients } from '../src/data/recipients.js';
import { sharedWishes } from '../src/data/sharedWishes.js';
import { SharedGalaxy2D as SharedGalaxy } from '../src/graphics/SharedGalaxy2D.js';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); },
    listeners
  };
}
function classList() {
  const values = new Set();
  return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
}
function gradient() { return { addColorStop() {} }; }
let captureGeometry = false;
let geometryHash = 2166136261;
const geometryMethods = new Set(['translate', 'rotate', 'arc', 'ellipse', 'moveTo', 'lineTo']);
function foldGeometry(method, args) {
  for (const character of String(method)) geometryHash = Math.imul(geometryHash ^ character.charCodeAt(0), 16777619) >>> 0;
  for (const value of args) {
    const numeric = Number(value);
    const word = Number.isFinite(numeric) ? Math.round(numeric * 1000) | 0 : String(value).length;
    geometryHash = Math.imul(geometryHash ^ word, 16777619) >>> 0;
  }
}
const context = new Proxy({
  setTransform() {}, createLinearGradient: gradient, createRadialGradient: gradient,
  fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {},
  fill() {}, stroke() {}, fillText() {}
}, {
  get(target, key) {
    const method = key in target ? target[key] : () => {};
    if (typeof method !== 'function') return method;
    return (...args) => { if (captureGeometry && geometryMethods.has(key)) foldGeometry(key, args); return method(...args); };
  },
  set(target, key, value) { target[key] = value; return true; }
});
function element(rect = { width: 1280, height: 800 }) {
  return Object.assign(eventTarget(), {
    style: {}, dataset: {}, classList: classList(), attributes: {}, children: [], disabled: false,
    getBoundingClientRect: () => ({ ...rect, left: 0, top: 0 }),
    getContext: () => context,
    setAttribute(key, value) { this.attributes[key] = value; },
    append(child) { this.children.push(child); },
    replaceChildren() { this.children = []; }
  });
}

const canvas = element();
const view = element();
const message = element();
const messageMeta = element();
const messageText = element();
const cometButton = element();
const accessibleGroup = element();
const swipeHint = element();
const docEvents = eventTarget();
const winEvents = eventTarget();
let reducedMotionMatches = false;
globalThis.matchMedia = query => ({ matches: query.includes('reduced-motion') ? reducedMotionMatches : false });
let nextFrameId = 0;
const frameQueue = new Map();
globalThis.requestAnimationFrame = callback => { const id = ++nextFrameId; frameQueue.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => { frameQueue.delete(id); };
function advanceFrame(timestamp) {
  const callbacks = [...frameQueue.values()];
  frameQueue.clear();
  for (const callback of callbacks) callback(timestamp);
}
globalThis.document = Object.assign(docEvents, {
  hidden: false,
  createElement: () => element(),
  querySelector: selector => selector === '#sharedCometButton' ? cometButton : selector === '#sharedGalaxyAccessibleNodes' ? accessibleGroup : selector === '#sharedGalaxySwipeHint' ? swipeHint : null
});
globalThis.window = Object.assign(winEvents, { devicePixelRatio: 1, visualViewport: eventTarget() });

const selections = [];
const galaxy = new SharedGalaxy({
  canvas, view, message, messageMeta, messageText, recipients, wishes: sharedWishes,
  onSelect: recipient => selections.push(recipient.slug)
});
assert.equal(accessibleGroup.children.length, 9, 'the canvas has accessible keyboard alternatives for all nine worlds');
const drawSignatures = [];
const originalDraw = galaxy.draw.bind(galaxy);
galaxy.draw = time => {
  captureGeometry = true;
  geometryHash = 2166136261;
  originalDraw(time);
  captureGeometry = false;
  drawSignatures.push(geometryHash >>> 0);
};
galaxy.start();
assert.equal(galaxy.active, true, 'shared galaxy enters the active render state');
assert.ok(galaxy.raf, 'start schedules the next animation frame');
const initialElapsed = galaxy.elapsed;
const initialFrameCount = galaxy.renderedFrames;
const frameBase = performance.now();
for (let i = 1; i <= 20; i++) advanceFrame(frameBase + i * 30);
assert.ok(galaxy.renderedFrames >= initialFrameCount + 20, 'render loop advances frame after frame instead of stopping after its first paint');
assert.ok(galaxy.elapsed > initialElapsed + .45, 'elapsed time progresses through requestAnimationFrame callbacks');
assert.ok(new Set(drawSignatures).size > 8, 'the coordinates passed to Canvas paths change across frames, not only the global frame counter');
galaxy.spawnComet(true, performance.now());
assert.ok(galaxy.comet, 'a manual comet can be spawned');
for (let i = 0; i < 56; i++) {
  galaxy.update(.1, performance.now() + i * 100);
  galaxy.draw(i / 10);
}
assert.equal(galaxy.comet, null, 'comet reaches the end of its trail decay and is removed');
assert.equal(cometButton.disabled, false, 'the comet control is unlocked after cleanup');
// Force one deterministic event and advance the real scheduler until its pulse reaches a neighbor.
galaxy.nextCometAt = Number.POSITIVE_INFINITY;
galaxy.nextEventAt = galaxy.elapsed + .06;
const eventBase = frameBase + 20 * 30;
for (let i = 1; i <= 80; i++) advanceFrame(eventBase + i * 30);
assert.ok(galaxy.cosmicEvents.length > 0, 'cosmic event is created by elapsed-time scheduling');
assert.ok(galaxy.cosmicEvents[0].type >= 0 && galaxy.cosmicEvents[0].type < 8, 'fallback scheduler chooses among eight distinct event visuals');
assert.ok(galaxy.cosmicEvents[0].reached.size >= 3, 'event cascades through at least two hops in the connected galaxy network');
const firstNode = galaxy.nodePoint(0);
assert.equal(galaxy.hitNode(firstNode.x, firstNode.y), 0, 'pointer hit-testing maps the first universe');
canvas.dispatch('pointerdown', { clientX: firstNode.x, clientY: firstNode.y, button: 0, preventDefault() {} });
assert.equal(selections[0], recipients[0].slug, 'choosing a node selects its original recipient');
galaxy.stop();
assert.equal(frameQueue.size, 0, 'stop removes the pending animation frame');
assert.equal(galaxy.active, false, 'stop cancels the active scene state');
galaxy.dispose();
assert.equal(accessibleGroup.children.length, 0, 'dispose clears the generated accessible controls');

// A reduced-motion user must still receive gentle, ongoing background motion instead of a frozen first frame.
reducedMotionMatches = true;
const reducedCanvas = element();
const reducedView = element();
const reducedGalaxy = new SharedGalaxy({ canvas: reducedCanvas, view: reducedView, recipients, wishes: sharedWishes });
reducedGalaxy.start();
assert.equal(reducedGalaxy.motionScale, .22, 'reduced motion scales elapsed time down to a gentle pace');
assert.ok(reducedGalaxy.raf, 'reduced motion still schedules continuous rendering');
const reducedInitialElapsed = reducedGalaxy.elapsed;
advanceFrame(performance.now() + 40);
assert.ok(reducedGalaxy.renderedFrames > 1 && reducedGalaxy.elapsed > reducedInitialElapsed, 'reduced motion progresses across multiple frames instead of freezing');
reducedGalaxy.stop();
reducedGalaxy.dispose();

const mobileCanvas = element({ width: 390, height: 844 });
const mobileView = element({ width: 390, height: 844 });
const mobileGalaxy = new SharedGalaxy({
  canvas: mobileCanvas, view: mobileView, recipients, wishes: sharedWishes,
  onSelect: recipient => selections.push(recipient.slug)
});
mobileGalaxy.start({ focusIndex: 4 });
assert.equal(mobileGalaxy.mobile, true, 'portrait-sized canvas enables the swipeable mobile layout');
assert.ok(Math.abs(mobileGalaxy.nodePoint(4).x - 195) < 1, 'the requested mobile galaxy opens centered in the fixed viewport');
assert.ok(Math.abs(mobileGalaxy.nodePoint(4).y - 422) < 1, 'the requested mobile galaxy opens centered vertically');
assert.ok(mobileGalaxy.nodePoint(2).x > mobileCanvas.getBoundingClientRect().width, 'later galaxies extend beyond the initial mobile viewport');
assert.equal(swipeHint.classList.contains('is-visible'), true, 'mobile entry shows the swipe hint');
assert.equal(swipeHint.attributes['aria-hidden'], 'false', 'the visible mobile hint is announced accessibly');
const firstMobileNode = { ...mobileGalaxy.nodePoint(4) };
mobileCanvas.dispatch('pointerdown', { clientX: firstMobileNode.x, clientY: firstMobileNode.y, pointerId: 7, button: 0, preventDefault() {} });
mobileCanvas.dispatch('pointermove', { clientX: firstMobileNode.x - 100, clientY: firstMobileNode.y, pointerId: 7, pointerType: 'touch', preventDefault() {} });
mobileCanvas.dispatch('pointerup', { clientX: firstMobileNode.x - 100, clientY: firstMobileNode.y, pointerId: 7 });
assert.equal(selections.length, 1, 'a swipe pans the scene without selecting the galaxy beneath the gesture');
assert.ok(Math.abs(mobileGalaxy.nodePoint(4).x - (firstMobileNode.x - 100)) < 1, 'the mobile galaxy field follows the swipe gesture');
const movedNode = { ...mobileGalaxy.nodePoint(4) };
mobileCanvas.dispatch('pointerdown', { clientX: movedNode.x, clientY: movedNode.y, pointerId: 8, button: 0, preventDefault() {} });
mobileCanvas.dispatch('pointerup', { clientX: movedNode.x, clientY: movedNode.y, pointerId: 8 });
assert.equal(selections[1], recipients[4].slug, 'a tap after panning still selects the centered galaxy');
mobileGalaxy.elapsed = 0;
mobileGalaxy.updateNodePositions();
const stillNode = { ...mobileGalaxy.nodePoint(4) };
mobileGalaxy.elapsed = 8;
mobileGalaxy.updateNodePositions();
assert.ok(Math.hypot(mobileGalaxy.nodePoint(4).x - stillNode.x, mobileGalaxy.nodePoint(4).y - stillNode.y) > 0.1, 'fallback galaxies gently drift and their hit targets move with them');
mobileGalaxy.stop();
assert.equal(swipeHint.classList.contains('is-visible'), false, 'leaving the mobile galaxy view dismisses the hint');
mobileGalaxy.dispose();
console.log(`Shared galaxy runtime test passed: ${galaxy.renderedFrames} scheduled frames, ${new Set(drawSignatures).size} changing Canvas-path signatures, event propagation, comet lifecycle, node picking, reduced-motion progression and cleanup.`);
