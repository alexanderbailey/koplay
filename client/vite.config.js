import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Convert oklch(L% C H) or oklch(L% C H / alpha) to #rrggbbaa hex.
// Needed because Tizen 5 (Chrome 63) doesn't support oklch().
// Tailwind v4 uses oklch for all built-in color tokens.
function oklchToHex(l, c, h, alpha) {
  const hRad = (h % 360) * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  const rLin =  4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const gLin = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bLin = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc;

  const gamma = x => {
    const v = Math.max(0, Math.min(1, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const r = Math.round(gamma(rLin) * 255);
  const g = Math.round(gamma(gLin) * 255);
  const bv = Math.round(gamma(bLin) * 255);
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;

  if (alpha !== undefined && alpha < 1) {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return hex;
}

// Strip @layer wrappers and @property declarations from CSS so it works
// on older Samsung Tizen WebViews (Chromium 63) that don't support them.
// Tailwind v4 outputs layers in correct source order, so unwrapping is safe.
function unwrapCSSLayers() {
  return {
    name: 'unwrap-css-layers',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;

        let css = typeof file.source === 'string' ? file.source : file.source.toString();

        // Remove @property declarations (Tailwind has @supports fallbacks for these)
        css = css.replace(/@property\s+[^{]+\{[^}]*\}/g, '');

        // Remove bare @layer declarations (e.g. @layer components;)
        css = css.replace(/@layer\s+[\w-]+\s*;/g, '');

        // Unwrap @layer blocks by matching balanced braces
        let result = '';
        let i = 0;
        while (i < css.length) {
          const layerMatch = css.slice(i).match(/^@layer\s+[\w-]+\s*\{/);
          if (layerMatch) {
            i += layerMatch[0].length;
            let depth = 1;
            let start = i;
            while (i < css.length && depth > 0) {
              if (css[i] === '{') depth++;
              else if (css[i] === '}') depth--;
              if (depth > 0) i++;
            }
            result += css.slice(start, i);
            i++; // skip closing brace
          } else {
            result += css[i];
            i++;
          }
        }

        // Convert oklch() colors to hex for Chrome <111.
        // Tailwind v4 stores all color tokens as oklch CSS variables; without
        // this, every var(--color-*) resolves to an invalid value → transparent.
        result = result.replace(
          /oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g,
          (match, l, c, h, alpha) => {
            try {
              let av;
              if (alpha !== undefined) {
                av = alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
              }
              return oklchToHex(parseFloat(l) / 100, parseFloat(c), parseFloat(h), av);
            } catch {
              return match;
            }
          }
        );

        // Convert CSS logical properties to physical for Chrome <69.
        // More specific variants must come before shorthand forms.
        result = result.replace(/padding-inline-start:([^;{}]+)/g, (_, v) => `padding-left:${v.trim()}`);
        result = result.replace(/padding-inline-end:([^;{}]+)/g,   (_, v) => `padding-right:${v.trim()}`);
        result = result.replace(/padding-block-start:([^;{}]+)/g,  (_, v) => `padding-top:${v.trim()}`);
        result = result.replace(/padding-block-end:([^;{}]+)/g,    (_, v) => `padding-bottom:${v.trim()}`);
        result = result.replace(/padding-inline:([^;{}]+)/g, (_, v) => { const val = v.trim(); return `padding-left:${val};padding-right:${val}`; });
        result = result.replace(/padding-block:([^;{}]+)/g,  (_, v) => { const val = v.trim(); return `padding-top:${val};padding-bottom:${val}`; });

        result = result.replace(/margin-inline-start:([^;{}]+)/g, (_, v) => `margin-left:${v.trim()}`);
        result = result.replace(/margin-inline-end:([^;{}]+)/g,   (_, v) => `margin-right:${v.trim()}`);
        result = result.replace(/margin-block-start:([^;{}]+)/g,  (_, v) => `margin-top:${v.trim()}`);
        result = result.replace(/margin-block-end:([^;{}]+)/g,    (_, v) => `margin-bottom:${v.trim()}`);
        result = result.replace(/margin-inline:([^;{}]+)/g, (_, v) => { const val = v.trim(); return `margin-left:${val};margin-right:${val}`; });
        result = result.replace(/margin-block:([^;{}]+)/g,  (_, v) => { const val = v.trim(); return `margin-top:${val};margin-bottom:${val}`; });

        // Prepend grid-gap as fallback for gap: so grid layouts keep their
        // spacing in Chrome 63 (flexbox gap support wasn't added until Chrome 84).
        result = result.replace(/(?<![a-z-])gap:([^;{}]+)/g, (_, v) => { const val = v.trim(); return `grid-gap:${val};gap:${val}`; });

        // Replace inset: shorthand with physical properties for Chrome <87.
        // Use a negative lookbehind so CSS variable names like --tw-ring-inset:
        // are not accidentally matched and corrupted.
        result = result.replace(/(?<![a-z-])inset:([^;}]+)/g, (_, val) => {
          const v = val.trim();
          return `top:${v};right:${v};bottom:${v};left:${v}`;
        });

        file.source = result;
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), unwrapCSSLayers()],
  build: {
    rollupOptions: {
      input: {
        tv: resolve(__dirname, 'tv.html'),
        phone: resolve(__dirname, 'phone.html'),
        // Dev-only UI harnesses (not shipped in production build)
        ...(command === 'serve'
          ? { 'dev-trivia-reveal': resolve(__dirname, 'dev-trivia-reveal.html') }
          : {}),
      },
    },
    outDir: 'dist',
    target: 'chrome63',
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
}));
