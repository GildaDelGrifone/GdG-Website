// Importa post WordPress (es. "Eventi della Serata") come file Markdown + immagini locali.
//
//   node scripts/import-wp.mjs <url> [<url> ...]
//   node scripts/import-wp.mjs [--file] links.txt      (un URL per riga, # per i commenti)
//   opzioni: --collection news (default: serate)   --force (sovrascrive i file esistenti)
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (p) => access(p).then(() => true, () => false);

async function resolveFile(filePath) {
  const candidates = [
    filePath,
    process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD, filePath) : null,
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'scripts', filePath),
  ].filter(Boolean);

  for (const c of candidates) {
    if (await exists(c)) return c;
  }
  return null;
}

async function loadUrlsFromFile(filePath) {
  const resolved = await resolveFile(filePath);
  if (!resolved) {
    console.error(`Errore: file non trovato "${filePath}"`);
    process.exit(1);
  }
  const lines = (await readFile(resolved, 'utf8')).split('\n');
  return lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

// Le immagini vivono nel bucket R2: qui si scaricano in public/uploads (ignorata da git) e poi si caricano con `npm run media:sync`.
const MEDIA_URL = (process.env.PUBLIC_MEDIA_URL ?? 'https://pub-78d1bc1209984397b893f711b29f8ca9.r2.dev').replace(/\/$/, '');

const args = process.argv.slice(2);
const urls = [];
let collection = 'serate';
let force = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') {
    console.log('Uso: node scripts/import-wp.mjs [--collection serate|news] [--force] <url> ... | [--file] <file.txt>');
    process.exit(0);
  } else if (a === '--force') {
    force = true;
  } else if (a === '--collection') {
    collection = args[++i];
  } else if (a === '--file') {
    const fileArg = args[++i];
    if (!fileArg) {
      console.error('Errore: specificare il percorso del file dopo --file');
      process.exit(1);
    }
    urls.push(...(await loadUrlsFromFile(fileArg)));
  } else if (a.endsWith('.txt') || a.endsWith('.list')) {
    urls.push(...(await loadUrlsFromFile(a)));
  } else {
    const resolved = await resolveFile(a);
    if (resolved && !a.startsWith('http://') && !a.startsWith('https://')) {
      urls.push(...(await loadUrlsFromFile(resolved)));
    } else {
      urls.push(a);
    }
  }
}

if (!urls.length) {
  console.error('Uso: node scripts/import-wp.mjs [--collection serate|news] [--force] <url> ... | [--file] <file.txt>');
  process.exit(1);
}

const td = new TurndownService({ headingStyle: 'atx', hr: '---', bulletListMarker: '-' });

// Decodifica le entità HTML (&#8217; ecc.) riusando turndown, senza altre dipendenze.
const decode = (html) => td.turndown(html).replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1').trim();

async function download(src, destDir) {
  const name = decodeURIComponent(new URL(src).pathname.split('/').pop());
  const dest = path.join(destDir, name);
  if (!(await exists(dest))) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Ridimensiona a 1600px di larghezza massima (e applica l'orientamento EXIF) per tenere leggero il repo.
    const buf = Buffer.from(await res.arrayBuffer());
    const small = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).toBuffer().catch(() => buf);
    await writeFile(dest, small);
  }
  return name;
}

async function importPost(url) {
  const u = new URL(url);
  const slug = u.pathname.split('/').filter(Boolean).pop();
  const api = `${u.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const [post] = await res.json();
  if (!post) throw new Error('post non trovato');

  const date = post.date.slice(0, 10);
  const outFile = path.join(projectRoot, 'src', 'content', collection, `${date}-${slug}.md`);
  if (!force && (await exists(outFile))) return { status: 'skipped', slug, images: 0 };

  const imgDir = path.join(projectRoot, 'public', 'uploads', collection, slug);
  const publicBase = `${MEDIA_URL}/${collection}/${slug}`;
  await mkdir(imgDir, { recursive: true });
  await mkdir(path.dirname(outFile), { recursive: true });

  let html = post.content.rendered;
  const featured = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  const sources = new Set([
    ...[...html.matchAll(/<img[^>]+src="([^"]+\/wp-content\/uploads\/[^"]+)"/g)].map((m) => m[1]),
    ...(featured ? [featured] : []),
  ]);

  const local = new Map();
  let images = 0;
  for (const src of sources) {
    try {
      local.set(src, `${publicBase}/${await download(src, imgDir)}`);
      images++;
    } catch (e) {
      console.warn(`  ! immagine non scaricata (${e.message}): ${src}`);
    }
  }

  for (const [src, dest] of local) html = html.split(src).join(dest);
  html = html.replace(/\s(style|decoding|srcset|sizes)="[^"]*"/g, '');

  const body = td.turndown(html).trim();
  const excerpt = decode(post.excerpt.rendered)
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/…|&hellip;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = excerpt.length > 160 ? excerpt.slice(0, 160).replace(/\s+\S*$/, '') + '…' : excerpt;

  const front = [
    '---',
    `title: ${JSON.stringify(decode(post.title.rendered))}`,
    `date: ${date}`,
    featured && local.has(featured) ? `cover: ${JSON.stringify(local.get(featured))}` : null,
    short ? `excerpt: ${JSON.stringify(short)}` : null,
    '---',
  ].filter(Boolean);

  await writeFile(outFile, `${front.join('\n')}\n\n${body}\n`);
  return { status: 'imported', slug, images, outFile };
}

const summary = { imported: 0, skipped: 0, failed: 0 };
for (const url of urls) {
  try {
    const r = await importPost(url);
    summary[r.status]++;
    console.log(`${r.status === 'imported' ? '✓' : '-'} ${r.status}: ${r.slug} (${r.images} immagini)`);
  } catch (e) {
    summary.failed++;
    console.error(`✗ ${url}: ${e.message}`);
  }
}
console.log(`\nImportati: ${summary.imported} · Saltati: ${summary.skipped} · Falliti: ${summary.failed}`);
process.exit(summary.failed ? 1 : 0);

