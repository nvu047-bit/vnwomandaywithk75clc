import { gsap } from 'gsap';
import { recipients, findRecipient } from './data/recipients.js';
import { StellarScene } from './graphics/StellarScene.js';
import { MathRain } from './graphics/MathRain.js';
import { FallbackScene } from './graphics/FallbackScene.js';
import { StellarInterface } from './ui/interface.js';
import './style.css';

// Font loading is progressive: the app should never remain behind the loader
// indefinitely because a font host is slow or unavailable.
if (document.fonts?.ready) document.fonts.ready.catch(() => {});
gsap.config({ autoSleep: 60, nullTargetWarn: false });
gsap.ticker.lagSmoothing(500, 33);

const canvas = document.querySelector('#universe');
const fallbackCanvas = document.querySelector('#fallbackUniverse');
const loadingMark = document.querySelector('#loadingMark');
const rainCanvas = document.querySelector('#equationRain');
const rain = rainCanvas ? new MathRain(rainCanvas, gsap) : null;
let scene = null;
let fallback = null;
let ui = null;
let fallbackActive = false;
let disposed = false;

function showFallbackCanvas() {
  if (canvas) canvas.style.display = 'none';
  if (fallbackCanvas) fallbackCanvas.style.display = 'block';
  document.body.classList.add('is-fallback');
}

function activateFallback(error) {
  if (fallbackActive || disposed) return;
  fallbackActive = true;
  console.warn('STELLAR is switching to the lightweight safety renderer:', error?.message || error);
  showFallbackCanvas();

  // Dispose the WebGL renderer before starting Canvas 2D so its GPU allocations
  // are released as promptly as possible on devices with limited graphics memory.
  if (scene) {
    try { scene.dispose(); }
    catch (disposeError) { console.warn('WebGL cleanup reported an error:', disposeError); }
    scene = null;
  }

  if (fallbackCanvas && !fallback) {
    try {
      fallback = new FallbackScene(fallbackCanvas, {
        onPhase: phase => ui?.setPhase(phase),
        onBurst: () => rain?.burst()
      });
    } catch (fallbackError) {
      // Last-resort styling still provides a themed canvas backdrop if Canvas 2D
      // is unavailable entirely; all HTML controls remain interactive.
      console.warn('Canvas 2D fallback is unavailable:', fallbackError);
      fallbackCanvas.classList.add('fallback-css-mode');
      document.body.classList.add('is-css-fallback');
      fallbackCanvas.style.display = 'block';
      fallbackCanvas.style.backgroundImage = 'radial-gradient(ellipse at 25% 35%, rgba(164,134,155,.3), transparent 48%), radial-gradient(ellipse at 75% 30%, rgba(130,144,173,.2), transparent 44%)';
    }
  }
  if (ui) {
    ui.scene = null;
    ui.fallback = fallback;
  }
}

function teardown() {
  if (disposed) return;
  disposed = true;
  window.removeEventListener('pagehide', onPageHide);
  ui?.destroy?.();
  // Stop animations before tearing down the renderers they may reference.
  try { scene?.dispose?.(); } catch (error) { console.warn('STELLAR scene cleanup:', error); }
  try { fallback?.dispose?.(); } catch (error) { console.warn('STELLAR fallback cleanup:', error); }
  try { rain?.dispose?.(); } catch (error) { console.warn('STELLAR rain cleanup:', error); }
  scene = null;
  fallback = null;
  if (window.STELLAR) delete window.STELLAR;
}

function onPageHide(event) {
  // Preserve a page entering the back-forward cache; it may be restored without
  // re-running module initialization. Full teardown is only needed on real exit.
  if (!event.persisted) teardown();
}

function start() {
  try {
    if (!canvas) throw new Error('The WebGL canvas #universe was not found');
    scene = new StellarScene(canvas, {
      onPhase: phase => ui?.setPhase(phase),
      onBurst: () => rain?.burst(),
      onError: activateFallback
    });
  } catch (error) {
    activateFallback(error);
  }

  ui = new StellarInterface({ scene, fallback, rain });
  if (fallbackActive) {
    ui.scene = null;
    ui.fallback = fallback;
  }

  window.STELLAR = {
    recipients,
    get scene() { return scene; },
    get fallback() { return fallback; },
    get activeRecipient() { return ui?.activeRecipient || null; },
    get sharedGalaxy() { return ui?.sharedGalaxy || null; },
    openRecipient: slugOrId => {
      const person = findRecipient(slugOrId);
      if (person && ui) ui.openRecipient(person);
    }
  };

  window.addEventListener('pagehide', onPageHide, { passive: true });
  requestAnimationFrame(() => loadingMark?.classList.add('is-ready'));
  ui.routeFromHash();
}

start();

// Vite hot replacement can re-run the entry module without a full page unload.
if (import.meta.hot) import.meta.hot.dispose(teardown);
