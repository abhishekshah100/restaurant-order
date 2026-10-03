import localFont from 'next/font/local';

/*
 * Manrope (UI) and Newsreader (display), bundled locally (SIL Open Font License).
 * Each family ships as two subsets, mirroring olive-core.css: `latin` and `latin-ext`.
 * The rupee sign (U+20B9) lives in the latin-ext files, so both subsets are loaded
 * with their original unicode-range and chained in --f-ui / --f-display (tokens.css).
 * Only the last subset of each chain carries the metric-adjusted fallback, so a
 * glyph missing from latin falls through to latin-ext before any system font.
 *
 * Weights: Manrope 400–800 (400 = UA default for form controls). Newsreader ships 500 only —
 * every --f-display use is weight 500; add a face here before using another display weight.
 */
// next/font needs literal arguments, so the unicode-range strings are repeated inline.

export const manrope = localFont({
  src: [
    { path: './manrope-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './manrope-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './manrope-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './manrope-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './manrope-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  variable: '--font-manrope',
  display: 'swap',
  adjustFontFallback: false,
});

export const manropeExt = localFont({
  src: [
    { path: './manrope-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './manrope-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './manrope-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './manrope-latin-ext-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './manrope-latin-ext-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  variable: '--font-manrope-ext',
  display: 'swap',
  preload: false,
  fallback: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
});

export const newsreader = localFont({
  src: [{ path: './newsreader-latin-500-normal.woff2', weight: '500', style: 'normal' }],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  variable: '--font-newsreader',
  display: 'swap',
  adjustFontFallback: false,
});

export const newsreaderExt = localFont({
  src: [{ path: './newsreader-latin-ext-500-normal.woff2', weight: '500', style: 'normal' }],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  variable: '--font-newsreader-ext',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const fontVariables = [manrope, manropeExt, newsreader, newsreaderExt]
  .map((f) => f.variable)
  .join(' ');
