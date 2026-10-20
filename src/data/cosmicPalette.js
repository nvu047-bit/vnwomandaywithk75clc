export const COSMIC_COLORS = Object.freeze({
  space: '#11121e',
  deepSpace: '#171724',
  dustyLavender: '#9b91ae',
  mauve: '#a4869b',
  periwinkle: '#8290ad',
  roseQuartz: '#b38f9f',
  paleLilac: '#b9acc5',
  mutedTeal: '#7f9b99',
  champagne: '#b9a485',
  pearl: '#ddd5d4',
  ink: '#f1edf0'
});

export const RECIPIENT_PALETTES = Object.freeze([
  [COSMIC_COLORS.roseQuartz, COSMIC_COLORS.dustyLavender, COSMIC_COLORS.mutedTeal],
  [COSMIC_COLORS.periwinkle, COSMIC_COLORS.dustyLavender, COSMIC_COLORS.roseQuartz],
  [COSMIC_COLORS.champagne, COSMIC_COLORS.roseQuartz, COSMIC_COLORS.paleLilac],
  [COSMIC_COLORS.mutedTeal, COSMIC_COLORS.periwinkle, COSMIC_COLORS.paleLilac],
  [COSMIC_COLORS.roseQuartz, COSMIC_COLORS.mutedTeal, COSMIC_COLORS.periwinkle],
  [COSMIC_COLORS.mutedTeal, COSMIC_COLORS.periwinkle, COSMIC_COLORS.pearl],
  [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.roseQuartz, COSMIC_COLORS.mutedTeal],
  [COSMIC_COLORS.roseQuartz, COSMIC_COLORS.paleLilac, COSMIC_COLORS.periwinkle],
  [COSMIC_COLORS.periwinkle, COSMIC_COLORS.paleLilac, COSMIC_COLORS.roseQuartz]
]);
