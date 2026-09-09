# App icons

`manifest.json` and `index.html` expect these four PNGs in this folder:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192×192 | Android home screen / PWA |
| `icon-512.png` | 512×512 | Android splash / install dialog |
| `icon-maskable-512.png` | 512×512 | Android adaptive icon (artwork kept inside the centre 80% safe zone) |
| `apple-touch-icon.png` | 180×180 | iOS home screen (no transparency) |

## Generating them

1. Save the trophy artwork here as **`icon-source.png`** — a real square PNG, ≥ 512×512.
2. From `client/`:  `npm run icons`

That runs [`scripts/generate-icons.mjs`](../../scripts/generate-icons.mjs) (uses `sharp`) and writes all four files.
The background colour it flattens against is `#10b981` — keep it in sync with `theme_color`
in [`../manifest.json`](../manifest.json) if you change the brand colour.

3. `npm run build`, then verify in DevTools → Application → Manifest that there are no icon errors.
