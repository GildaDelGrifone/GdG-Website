// Importa post WordPress (es. "Eventi della Serata") come file Markdown + immagini locali.
//
//   node scripts/import-wp.mjs <url> [<url> ...]
//   node scripts/import-wp.mjs [--file] links.txt      (un URL per riga, # per i commenti)
//   opzioni: --collection news (default: serate)   --force (sovrascrive i file esistenti)
//   WP_IP=1.2.3.4 node scripts/import-wp.mjs ...   (raggiunge il vecchio server WordPress direttamente per IP,
//   utile quando il dominio punta già al nuovo sito)
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import sharp from 'sharp';
import https from 'node:https';

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
const MEDIA_URL = (process.env.PUBLIC_MEDIA_URL ?? 'https://media.gildadelgrifonetorino.it').replace(/\/$/, '');

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

// Con WP_IP le richieste verso il vecchio WordPress vanno a quell'indirizzo, ma con il nome del sito (TLS e Host restano corretti).
const WP_IP = process.env.WP_IP;

function fetchViaIp(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { lookup: (_host, opts, cb) => (opts?.all ? cb(null, [{ address: WP_IP, family: 4 }]) : cb(null, WP_IP, 4)) }, (res) => {
      const { statusCode = 0, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchViaIp(new URL(headers.location, url).href, redirects - 1));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          arrayBuffer: async () => body,
          json: async () => JSON.parse(body.toString('utf8')),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

// Solo gli indirizzi del vecchio sito passano da WP_IP (anche se nei post sono scritti con http://); gli altri, ad esempio immagini ospitate altrove, vanno normalmente.
const isOwnSite = (url) => /(^|\.)gildadelgrifonetorino\.it$/.test(new URL(url).hostname);
const wpFetch = (url) => (WP_IP && isOwnSite(url) ? fetchViaIp(url.replace(/^http:/, 'https:')) : fetch(url));

// I post vecchi usano shortcode di plugin/page builder che WordPress espande solo a runtime: qui li convertiamo o li togliamo.
const Q = '(?:&#822[0-9];|&#8243;|["”″])?'; // virgolette (anche tipografiche) attorno ai valori degli attributi
const attr = (tag, name) => tag.match(new RegExp(`${name}=${Q}([^\\s\\]&"”″]+)`))?.[1];

async function expandShortcodes(html, origin) {
  // [us_image image="201"] → <img> dell'allegato (si chiede l'indirizzo alla API dei media)
  for (const tag of new Set(html.match(/\[us_image[^\]]*\]/g) ?? [])) {
    const id = attr(tag, 'image');
    let img = '';
    try {
      const m = id && (await (await wpFetch(`${origin}/wp-json/wp/v2/media/${id}?_fields=source_url,alt_text`)).json());
      if (m?.source_url) img = `<img src="${m.source_url}" alt="${m.alt_text ?? ''}">`;
    } catch {}
    html = html.split(tag).join(img);
  }
  // [pdf-embedder url="….pdf" title="…"] → link al PDF
  html = html.replace(/\[pdf-embedder[^\]]*\]/g, (tag) => {
    const url = tag.match(new RegExp(`url=${Q}(https?:[^\\s"”″&]+?\\.pdf)`))?.[1];
    const title = tag.match(new RegExp(`title=${Q}([^&"”″\\]]+)`))?.[1] ?? 'Scarica il PDF';
    return url ? `<p><a href="${url}">${title.trim()}</a></p>` : '';
  });
  return stripShortcodes(html);
}

// Toglie i restanti shortcode del page builder (Visual Composer / Impreza), tenendo il testo che contengono.
const stripShortcodes = (text) => text.replace(/\[\/?(?:vc|us)_[^\]]*\]|\[pdf-embedder[^\]]*\]/g, '');

const td = new TurndownService({ headingStyle: 'atx', hr: '---', bulletListMarker: '-' });

// Decodifica le entità HTML (&#8217; ecc.) riusando turndown, senza altre dipendenze.
const decode = (html) => td.turndown(html).replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1').trim();

async function download(src, destDir) {
  const name = decodeURIComponent(new URL(src).pathname.split('/').pop());
  const dest = path.join(destDir, name);
  if (!(await exists(dest))) {
    const res = await wpFetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Ridimensiona a 1600px di larghezza massima (e applica l'orientamento EXIF) per tenere leggero il repo.
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true });
    // I PNG delle vecchie copertine pesano ~2 MB: la palette a 256 colori li riduce molto senza cambiare formato o nome.
    const small = await (/\.png$/i.test(name) ? img.png({ palette: true, quality: 85, compressionLevel: 9 }) : img).toBuffer().catch(() => buf);
    await writeFile(dest, small);
  }
  return name;
}

async function importPost(url) {
  const u = new URL(url);
  const slug = u.pathname.split('/').filter(Boolean).pop();
  const api = `${u.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`;
  const res = await wpFetch(api);
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

  let html = await expandShortcodes(post.content.rendered, u.origin);
  const featured = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  const sources = new Set([
    ...[...html.matchAll(/<img[^>]+src="([^"]+\/wp-content\/uploads\/[^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<a[^>]+href="([^"]+\/wp-content\/uploads\/[^"]+)"/g)].map((m) => m[1]),
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
  const excerpt = decode(stripShortcodes(post.excerpt.rendered))
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

