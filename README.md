# Sito della Gilda del Grifone Torino

Sito statico con [Astro](https://astro.build). Contenuti in Markdown/JSON, modificabili da `/admin` (Sveltia CMS).
Online su https://www.gildadelgrifonetorino.it. Per chi lavora sul codice con un assistente AI: vedi [`AGENTS.md`](AGENTS.md).

## Sviluppo

Serve Node 22 (con Node 20 `npm run check` non parte).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # build in dist/
npm run check    # controllo tipi (astro check)
```

## Dove sta cosa

| Cosa | Dove |
|---|---|
| Contatti, orari, link Telegram, link CSV della ludoteca | `src/data/site.json` |
| Manuali GdR | `src/data/manuali.json` |
| Consiglio direttivo e staff | `src/data/chi-siamo.json` |
| Resoconti serate / News / Collaborazioni | `src/content/{serate,news,collaborazioni}/*.md` |
| Schema dei contenuti | `src/content.config.ts` |
| Pagine, layout, componenti | `src/pages/`, `src/layouts/BaseLayout.astro`, `src/components/` |
| Indirizzi degli articoli, dati strutturati, dimensioni immagini | `src/lib/urls.ts`, `src/lib/schema.ts`, `src/lib/images.ts` |
| Immagini caricate | bucket R2 `gdg-media` (cartella locale `public/uploads/`, ignorata da git; carica con `npm run media:sync`) |
| CMS | `public/admin/config.yml` |
| Deploy Cloudflare | `wrangler.jsonc` |
| `robots.txt` | `public/robots.txt` (il sitemap è generato: `/sitemap-index.xml`) |

## Indirizzi (URL)

I file in `src/content/serate/` si chiamano `AAAA-MM-GG-titolo.md` (la data li tiene in ordine), ma l'indirizzo della pagina **non** contiene la data:
`src/content/serate/2026-10-28-eventi-della-serata-mercoledi-28-10-2026.md` → `/serate/eventi-della-serata-mercoledi-28-10-2026/`.
Lo stesso vale per le news (`/news/<titolo>/`). Due articoli con lo stesso titolo nella stessa raccolta fanno fallire la build, così non se ne perde nessuno.
I vecchi indirizzi di WordPress non vengono reindirizzati: le pagine principali (`/chi-siamo/`, `/gioco-di-ruolo-torino/`, `/giochi-da-tavolo-torino/`, `/news/`) hanno lo stesso indirizzo di prima.

## SEO

- I titoli e le descrizioni di Home, Chi siamo, Gioco di ruolo e Ludoteca sono quelli del vecchio sito (`seoTitle` nelle pagine): non cambiarli senza motivo.
- `BaseLayout.astro` aggiunge canonical, Open Graph e Twitter card; gli articoli hanno anche `og:type=article` e le briciole di pane.
- `src/lib/schema.ts` genera i dati strutturati (associazione con indirizzo e orari presi da `site.json`, sito web, articolo, briciole di pane).
- Il nome del sito si aggiunge al titolo solo se resta entro 60 caratteri; le descrizioni vengono portate tra 70 e 160 caratteri (`src/lib/seo.ts`). Le immagini nel testo degli articoli ricevono `width`/`height` in fase di build (`src/lib/rehype-image-size.ts`).
- Immagine di anteprima per i social: `public/og.png` (1200×630, logo su sfondo scuro; il logo completo è `public/logo-full.png`). Gli articoli usano la propria copertina.
- Sitemap, feed RSS (`/rss.xml`) e `robots.txt` (blocca solo `/admin/`).

## Ludoteca (Google Sheet)

La pagina `/giochi-da-tavolo-torino` legge il CSV pubblicato del tab **Elenco Pubblico** (URL in `site.json` → `sheetCsvUrl`) e usa solo le colonne
`ID, TITOLO, CATEGORIA, DESCRIZIONE, ARMADIO, STATUS`. Se il foglio non è raggiungibile usa lo snapshot `/games.json`, generato a ogni build.

**Non pubblicare mai il tab con i dati dei soci** (nome, telefono, mail): un CSV pubblicato è leggibile da chiunque abbia il link.

## Importare i vecchi post

Lo script legge i post dalla API pubblica del vecchio sito WordPress, scarica le immagini in `public/uploads/<collezione>/<slug>/`
(le ridimensiona a 1600 px di larghezza al massimo) e crea il file Markdown in `src/content/<collezione>/`, con le immagini che puntano a `https://media.gildadelgrifonetorino.it`
(cambiabile con la variabile `PUBLIC_MEDIA_URL`).

```sh
npm run import:wp -- https://www.gildadelgrifonetorino.it/eventi-della-serata-lunedi-26-10-2026/
npm run import:wp -- scripts/links_serate.txt  # un URL per riga, # per i commenti (equivale a --file)
npm run import:wp -- --collection news <url>   # per le news (default: serate)
npm run import:wp -- --force <url>             # sovrascrive un post già importato
npm run media:sync                             # DOPO l'import: carica le immagini nel bucket R2
```

I post già importati vengono saltati; un link sbagliato viene segnalato senza fermare gli altri.
Lo script converte anche gli shortcode dei vecchi plugin (`[us_image]` diventa un'immagine, `[pdf-embedder]` un link al PDF scaricato) e comprime i PNG pesanti.

Se il dominio punta già al nuovo sito, il vecchio WordPress risponde ancora direttamente all'indirizzo del suo server: si usa `WP_IP`
(`WP_IP=91.134.222.241 npm run import:wp -- --collection news scripts/links_varie.txt`). Funziona finché l'hosting Serverlet è attivo.
`media:sync` usa `aws s3 sync` e le credenziali in `.bucketkey` (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`); il file è ignorato da git e **non va mai committato**.

## CMS

1. Il repository GitHub è già impostato in `public/admin/config.yml` (`backend.repo`). Ogni salvataggio fa un commit su `main`.
2. Prova in locale: `npm run dev`, poi in un secondo terminale `npx @sveltia/cms-proxy` (o usa il pulsante di login locale) e apri `/admin`.
3. **Accesso in produzione**: il pulsante "Login with GitHub" passa da Netlify e qui non funziona. Usa **Sign In Using Token** con un token personale a grana fine
   (GitHub → Settings → Developer settings → Fine-grained tokens; proprietario `GildaDelGrifone`, repository `GdG-Website`, permesso *Contents: Read and write*).
   In alternativa si può mettere un proxy OAuth (es. `sveltia-cms-auth` su Cloudflare Workers) in `backend.base_url`.
4. **Immagini**: il CMS le carica direttamente nel bucket R2 `gdg-media` (cartella `cms/`). Nel selettore immagini scegli "Cloudflare R2"; la prima volta chiede la *Secret Access Key* del token R2,
   che va consegnata in privato (non è nel repository). Il bucket deve avere una policy CORS con l'origine `https://www.gildadelgrifonetorino.it` e i metodi GET, PUT, HEAD, DELETE.
   Per provare gli upload in locale bisogna aggiungere temporaneamente `http://localhost:4321` alle origini.

## Pubblicazione

Il sito è su **Cloudflare Workers** (file statici da `dist/`, vedi `wrangler.jsonc`), collegato al repository: a ogni push su `main` Cloudflare esegue
`npm run build` e poi `npx wrangler deploy` (variabile `NODE_VERSION=22`).

## Dominio e DNS

- Il dominio `gildadelgrifonetorino.it` è registrato presso **OVH**; i nameserver sono quelli di **Cloudflare**, dove si gestiscono i record DNS.
- Domini personalizzati del Worker: `www.gildadelgrifonetorino.it` (indirizzo canonico) e `gildadelgrifonetorino.it`, che con una Redirect Rule va su `www`.
  Impostazioni attive: Always Use HTTPS, versione minima TLS 1.2.
- `media.gildadelgrifonetorino.it` è il dominio personalizzato del bucket R2 `gdg-media`.
- I record di posta (MX, SPF, `mail`, `imap`, `pop3`, `smtp`, `webmail`, autoconfig) sono quelli del vecchio hosting Serverlet e devono restare **"DNS only"** (nuvola grigia), mai proxied.

## Bot Telegram

Il bot [GdG-Event-Bot](https://github.com/GildaDelGrifone/GdG-Event-Bot) genera il resoconto della serata e lo scrive in `src/content/serate/<data>-<titolo>.md`
su un ramo `serata/<titolo>` (bozza); il pulsante "Pubblica" unisce il ramo a `main` e Cloudflare pubblica il sito. Se si cambiano i campi dei contenuti in `src/content.config.ts` va aggiornato anche il bot.
