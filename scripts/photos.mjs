// Prepara le foto di un catalogo (GdR, in futuro la ludoteca) per il bucket R2.
// Legge il CSV pubblicato (o un file locale), prende la prima foto di ogni riga e crea in public/uploads/<dest>/:
//   thumb/<slug>.webp  400 px di larghezza (anteprima)
//   <slug>.webp        lato lungo max 1200 px (foto ingrandita)
// Poi: npm run media:sync
//
//   npm run media:photos -- --csv <url|file.csv> --src .sandbox/GdR_Photos --dest gdr [--column "File foto"] [--force]
import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import sharp from 'sharp';
import { photoSlug } from '../src/scripts/photo-slug.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const csvArg = opt('csv');
const src = opt('src');
const dest = opt('dest');
const column = opt('column', 'File foto');
const force = args.includes('--force');

if (!csvArg || !src || !dest) {
  console.error('Uso: npm run media:photos -- --csv <url|file.csv> --src <cartella foto> --dest <cartella su R2> [--column "File foto"] [--force]');
  process.exit(1);
}

const csv = /^https?:\/\//.test(csvArg)
  ? await fetch(csvArg).then((r) => {
      if (!r.ok) throw new Error(`CSV: HTTP ${r.status}`);
      return r.text();
    })
  : await fs.readFile(csvArg, 'utf8');

const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
if (data.length && !(column in data[0])) throw new Error(`Colonna "${column}" non trovata nel CSV`);

// Prima foto di ogni riga → slug (deve coincidere con quello calcolato dal sito)
const photos = new Map();
for (const row of data) {
  const file = (row[column] ?? '').split('\n')[0].trim();
  if (!file) continue;
  const slug = photoSlug(file);
  if (photos.has(slug) && photos.get(slug) !== file) {
    throw new Error(`Due foto diverse con lo stesso slug "${slug}": "${photos.get(slug)}" e "${file}"`);
  }
  photos.set(slug, file);
}

// Indice dei file nella cartella, normalizzato (NFC) per non dipendere da come il filesystem salva gli accenti
const onDisk = new Map((await fs.readdir(src)).map((f) => [f.normalize('NFC'), f]));

const outDir = path.join('public/uploads', dest);
await fs.mkdir(path.join(outDir, 'thumb'), { recursive: true });

const exists = (p) => fs.access(p).then(() => true, () => false);
const missing = [];
let done = 0;
let skipped = 0;

for (const [slug, file] of photos) {
  const real = onDisk.get(file.normalize('NFC'));
  if (!real) {
    missing.push(file);
    continue;
  }
  const thumb = path.join(outDir, 'thumb', `${slug}.webp`);
  const full = path.join(outDir, `${slug}.webp`);
  if (!force && (await exists(thumb)) && (await exists(full))) {
    skipped++;
    continue;
  }
  const input = path.join(src, real);
  // rotate() senza argomenti applica l'orientamento EXIF
  await sharp(input).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toFile(thumb);
  await sharp(input).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(full);
  done++;
  process.stdout.write(`\r${done} foto elaborate`);
}

console.log(`\nFatto: ${done} elaborate, ${skipped} già presenti, ${missing.length} mancanti → ${outDir}`);
if (missing.length) {
  console.log('Foto non trovate in', src);
  missing.forEach((f) => console.log(' -', f));
  process.exitCode = 1;
}
