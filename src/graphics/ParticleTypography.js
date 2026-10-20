let typographyReadyPromise = null;

/**
 * Resolve the exact font faces used by the canvas glyph sampler before any
 * morph targets are rasterized. Canvas snapshots do not update retroactively
 * when a web font finishes loading, so sampling too early permanently captures
 * a fallback face for the life of the scene.
 */
export function prepareParticleTypography(timeoutMs = 1600) {
  if (typographyReadyPromise) return typographyReadyPromise;
  if (typeof document === 'undefined' || !document.fonts?.load) {
    console.warn('Web fonts cannot be verified; STELLAR will use system sans-serif fallbacks.');
    typographyReadyPromise = Promise.resolve(false);
    return typographyReadyPromise;
  }

  let timeoutId;
  const fontPromise = Promise.all([
    document.fonts.load('900 370px "Baloo 2"', 'KIỀU CHÂM NGUYỄN PHƯƠNG THẢO'),
    document.fonts.load('900 80px "Nunito Sans"', 'NGUYỄN THỊ KHÁNH LINH'),
    document.fonts.load('800 275px "Plus Jakarta Sans"', 'HNUE SMCS K75CLC 20·10')
  ]).then(([baloo, nunito, jakarta]) => {
    const recipientLoaded = baloo.some(font => font.family.toLowerCase() === 'baloo 2')
      || nunito.some(font => font.family.toLowerCase() === 'nunito sans');
    const signatureLoaded = jakarta.some(font => font.family.toLowerCase() === 'plus jakarta sans')
      || nunito.some(font => font.family.toLowerCase() === 'nunito sans');
    if (!recipientLoaded) console.warn('Baloo 2/Nunito Sans are unavailable; particle names will use a system fallback.');
    if (!signatureLoaded) console.warn('Plus Jakarta Sans is unavailable; HNUE/SMCS/K75CLC will use a system fallback.');
    return recipientLoaded && signatureLoaded;
  }).catch(error => {
    console.warn('STELLAR display fonts could not be loaded; particle text will use system fallbacks:', error);
    return false;
  });

  const timeoutPromise = new Promise(resolve => {
    timeoutId = window.setTimeout(() => {
      console.warn('Display font loading timed out; canvas glyphs will use the available fallback font.');
      resolve(false);
    }, Math.max(0, timeoutMs));
  });
  typographyReadyPromise = Promise.race([fontPromise, timeoutPromise])
    .finally(() => window.clearTimeout(timeoutId));
  return typographyReadyPromise;
}
