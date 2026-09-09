/**
 * Generates the PWA / home-screen icons from a single source image.
 *
 *   1. Save the app artwork as  client/public/icons/icon-source.png
 *      Ideally square and >= 1024x1024. A full-bleed background (the artwork
 *      already fills the frame edge to edge) works best for the maskable icon.
 *   2. Run  npm run icons   from client/  (or  npm run icons --workspace=client).
 *
 * Outputs (referenced by manifest.json and index.html):
 *   icon-192.png             192x192  "any" purpose
 *   icon-512.png             512x512  "any" purpose
 *   icon-maskable-512.png    512x512  "maskable" — full-bleed so Android's crop never clips it
 *   apple-touch-icon.png     180x180  opaque (iOS shows no transparency)
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { access } from 'node:fs/promises';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SOURCE = join(ICONS_DIR, 'icon-source.png');

// Keep in sync with theme_color / background_color in public/manifest.json.
const BG = '#10b981';

async function main() {
  try {
    await access(SOURCE);
  } catch {
    console.error(`\n  Missing source image: ${SOURCE}` +
      `\n  Save your app artwork there (square, >= 1024px) and re-run.\n`);
    process.exit(1);
  }

  let width, height;
  try {
    ({ width, height } = await sharp(SOURCE).metadata());
  } catch {
    console.error(`\n  ${SOURCE} is empty or not a valid image.` +
      `\n  Re-save the trophy artwork there as a real PNG (>= 1024x1024) and re-run.\n`);
    process.exit(1);
  }
  if (!width || !height || width !== height) {
    console.warn(`  Note: source is ${width}x${height}. A square source avoids the edge crop below.`);
  }
  if (Math.min(width ?? 0, height ?? 0) < 512) {
    console.warn(`  Note: source is small (${width}x${height}); icons will look soft. 1024px+ is recommended.`);
  }

  // "any" icons: fill the square, cropping the shorter side if the source
  // isn't square. The trophy sits well inside the frame so nothing important
  // is lost, and there are no transparent bars.
  await sharp(SOURCE).resize(192, 192, { fit: 'cover', position: 'centre' })
    .png().toFile(join(ICONS_DIR, 'icon-192.png'));

  await sharp(SOURCE).resize(512, 512, { fit: 'cover', position: 'centre' })
    .png().toFile(join(ICONS_DIR, 'icon-512.png'));

  // Maskable: same full-bleed fill. Because the artwork already carries its own
  // background edge to edge, this needs no extra padding — Android's circle /
  // squircle crop only ever eats into that background, never the trophy.
  await sharp(SOURCE).resize(512, 512, { fit: 'cover', position: 'centre' })
    .png().toFile(join(ICONS_DIR, 'icon-maskable-512.png'));

  // iOS home screen: opaque, no alpha channel.
  await sharp(SOURCE).resize(180, 180, { fit: 'cover', position: 'centre' })
    .flatten({ background: BG })
    .png().toFile(join(ICONS_DIR, 'apple-touch-icon.png'));

  console.log('  Icons written to public/icons/ — rebuild and check DevTools > Application > Manifest.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
