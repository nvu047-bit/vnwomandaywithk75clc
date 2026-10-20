import { defineConfig } from 'vite';
import { gzipSync } from 'node:zlib';

/**
 * Emit optional pre-compressed text assets alongside their normal files.
 * Static hosts such as Nginx can serve these with gzip_static / Content-Encoding:
 * gzip. Normal Vite dev/preview operation continues to use the uncompressed files.
 */
function precompressTextAssets() {
  const textAsset = /\.(?:js|mjs|cjs|css|html|svg|json|txt|xml|webmanifest)$/i;
  return {
    name: 'stellar-precompress-assets',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entries = Object.entries(bundle);
      for (const [fileName, output] of entries) {
        if (!textAsset.test(fileName) || fileName.endsWith('.gz')) continue;
        const raw = output.type === 'chunk' ? output.code : output.source;
        const source = Buffer.isBuffer(raw) ? raw : raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(String(raw ?? ''));
        if (source.length < 256) continue;
        const compressed = gzipSync(source, { level: 9 });
        // Avoid writing a .gz copy where compression would not save meaningful space.
        if (compressed.length < source.length - 96) {
          this.emitFile({ type: 'asset', fileName: `${fileName}.gz`, source: compressed });
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [precompressTextAssets()],
  server: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: process.env.STELLAR_SOURCEMAP === 'true',
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/');
          // Keep Three.js core and its addons together to avoid duplicate renderer
          // internals; GSAP is an independent vendor chunk and can be cached alone.
          if (normalized.includes('/node_modules/three/')) return 'three-vendor';
          if (normalized.includes('/node_modules/gsap/')) return 'gsap-vendor';
          return undefined;
        }
      }
    }
  }
});
