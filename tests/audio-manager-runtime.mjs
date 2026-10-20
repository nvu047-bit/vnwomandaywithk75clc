import assert from 'node:assert/strict';
import { AudioManager } from '../src/audio/AudioManager.js';

class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.volume = 1;
    this.listeners = new Map();
    this.playCount = 0;
    FakeAudio.instances.push(this);
  }

  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(callback);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  play() {
    this.playCount++;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  removeAttribute() {}
  load() {}
}

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty() {} };
  }

  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(callback);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) || []) callback(event);
  }
}

class FakeDocument {
  hidden = false;
  elements = new Map([
    ['#audioMuteButton', new FakeElement()],
    ['#audioVolume', new FakeElement('0.2')],
    ['#audioStatus', new FakeElement()]
  ]);
  listeners = new Map();

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }

  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(callback);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) || []) callback(event);
  }
}

const originalPerformance = globalThis.performance;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
let clock = 0;
let nextFrame = 0;
const frames = new Map();
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
globalThis.requestAnimationFrame = callback => {
  const id = ++nextFrame;
  frames.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = id => frames.delete(id);

function flushFades() {
  while (frames.size) {
    clock += 1000;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(clock));
  }
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

try {
  const documentRef = new FakeDocument();
  const manager = new AudioManager({ documentRef, AudioClass: FakeAudio });
  const bgm = FakeAudio.instances[0];
  const muteButton = documentRef.querySelector('#audioMuteButton');
  const slider = documentRef.querySelector('#audioVolume');
  const eventTarget = { closest: () => null };

  assert.equal(bgm.playCount, 0, 'the track does not autoplay before a user gesture');
  documentRef.dispatch('pointerdown', { target: eventTarget });
  documentRef.dispatch('pointerdown', { target: eventTarget });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(bgm.playCount, 1, 'initial interaction starts only one BGM stream');
  await manager.requestPlayback();
  assert.equal(manager.playPromise, null, 'completed playback requests do not leave a stale pending state');
  assert.equal(bgm.playCount, 1, 'subsequent screen activity does not create another BGM stream');
  flushFades();
  assert.equal(bgm.volume, 0.2, 'BGM fades to the configured default volume');

  bgm.currentTime = 35;
  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  clock += 1000;
  await wait(60);
  assert.equal(bgm.paused, true, 'BGM pauses after fading out when the tab is hidden');
  assert.equal(bgm.volume, 0, 'background fade completes without relying on requestAnimationFrame');
  documentRef.hidden = false;
  documentRef.dispatch('visibilitychange');
  await Promise.resolve();
  await Promise.resolve();
  flushFades();
  assert.equal(bgm.playCount, 2, 'returning to the tab resumes the existing stream');
  assert.equal(bgm.currentTime, 35, 'resuming does not restart the track');

  manager.setBgmVolume(0.12);
  flushFades();
  assert.equal(bgm.volume, 0.12, 'the volume control changes the music level');
  slider.value = '0.1';
  slider.dispatch('input');
  flushFades();
  assert.equal(bgm.volume, 0.1, 'the visible range input updates BGM volume');

  muteButton.dispatch('click');
  flushFades();
  assert.equal(manager.muted, true, 'the mute control updates the muted state');
  assert.equal(bgm.paused, true, 'muting fades the track before pausing');
  muteButton.dispatch('click');
  await Promise.resolve();
  await Promise.resolve();
  flushFades();
  assert.equal(manager.muted, false, 'the mute control restores sound');
  assert.equal(bgm.currentTime, 35, 'unmuting does not restart the track');

  manager.playSfx('hover');
  manager.playSfx('tap');
  manager.playSfx('shimmer');
  assert.equal(manager.activeSfx.size, 2, 'SFX voices stay within the configured polyphony limit');
  manager.setSfxVolume(0.2);
  assert.equal([...manager.activeSfx.keys()][0].volume, 0.2, 'the independent SFX volume updates active effects');

  manager.dispose();
  assert.equal(bgm.paused, true, 'cleanup stops the BGM stream');
  assert.equal(manager.activeSfx.size, 0, 'cleanup stops all active SFX voices');
  console.log('Audio manager runtime tests passed.');
} finally {
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: originalPerformance });
  if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  else delete globalThis.requestAnimationFrame;
  if (originalCancelAnimationFrame) globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  else delete globalThis.cancelAnimationFrame;
}
