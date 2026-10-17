// Writes the DriveSense logo SVGs from src/brand/logo.ts (spec 2026-10-17, brand logo).
// Node 25 loads the .ts module directly; build-brand-assets.sh renders these to PNG.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BRAND_INK, BRAND_ROAD, centreDashes, FADE_TOP_Y, HORIZON, LOGO_SIZE, roadPath, TILE_RADIUS} from '../src/brand/logo.ts';

const S = LOGO_SIZE;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'brand');

const fade = `<defs><linearGradient id="roadFade" x1="0" y1="${S}" x2="0" y2="${FADE_TOP_Y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND_ROAD}" stop-opacity="0"/><stop offset="1" stop-color="${BRAND_ROAD}"/></linearGradient></defs>`;
const art = (roadFill) =>
  `<line x1="${HORIZON.x1}" x2="${HORIZON.x2}" y1="${HORIZON.y}" y2="${HORIZON.y}" stroke="${BRAND_ROAD}" stroke-opacity="${HORIZON.opacity}" stroke-width="${HORIZON.width}" stroke-linecap="round"/>` +
  `<path d="${roadPath()}" fill="${roadFill}"/>` +
  `<path d="${centreDashes(0)}" fill="${BRAND_INK}"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${body}</svg>\n`;
// Android crops adaptive icons to the central 66 %; keep the road inside it.
const inset = (S * (1 - 0.66)) / 2;

const files = {
  'logo-tile.svg': svg(`<rect width="${S}" height="${S}" rx="${TILE_RADIUS}" fill="${BRAND_INK}"/>${art(BRAND_ROAD)}`),
  'icon.svg': svg(`<rect width="${S}" height="${S}" fill="${BRAND_INK}"/>${art(BRAND_ROAD)}`),
  'logo-mark.svg': svg(`${fade}${art('url(#roadFade)')}`),
  'adaptive-foreground.svg': svg(`${fade}<g transform="translate(${inset} ${inset}) scale(0.66)">${art('url(#roadFade)')}</g>`),
};

mkdirSync(out, {recursive: true});
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(out, name), content);
}
console.log(`wrote ${Object.keys(files).length} SVGs to assets/brand`);
