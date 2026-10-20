import { SharedGalaxyGL } from './shared/SharedGalaxyGL.js';
import { SharedGalaxy2D } from './SharedGalaxy2D.js';

/**
 * Public shared-galaxy entry point used by the interface. The living sky is a
 * single WebGL scene (SharedGalaxyGL). Only if WebGL cannot be created does it
 * fall back to the earlier Canvas 2D renderer, so the screen never goes blank.
 */
export class SharedGalaxy {
  constructor(options) {
    const originalCanvas = options.canvas;
    const webglCanvas = originalCanvas?.cloneNode(false);
    const webglOptions = webglCanvas ? { ...options, canvas: webglCanvas } : options;
    try {
      this.impl = new SharedGalaxyGL(webglOptions);
      if (webglCanvas && originalCanvas?.parentNode) originalCanvas.replaceWith(webglCanvas);
      this.renderer = 'webgl';
      options.view?.setAttribute('data-renderer', this.renderer);
    } catch (error) {
      this.fallbackError = error;
      console.error('STELLAR shared galaxy WebGL initialization failed; using the Canvas 2D fallback:', error);
      const fallbackCanvas = originalCanvas?.cloneNode(false);
      if (fallbackCanvas && originalCanvas.parentNode) originalCanvas.replaceWith(fallbackCanvas);
      const fallbackOptions = fallbackCanvas ? { ...options, canvas: fallbackCanvas } : options;
      this.impl = new SharedGalaxy2D(fallbackOptions);
      this.renderer = 'canvas2d';
      options.view?.setAttribute('data-renderer', this.renderer);
      if (import.meta.env?.DEV) options.view?.setAttribute('data-renderer-error', String(error?.message || error));
    }
  }
  start(options) { this.impl.start(options); }
  stop() { this.impl.stop(); }
  dispose() { this.impl.dispose(); }
  get active() { return this.impl.active; }
}
