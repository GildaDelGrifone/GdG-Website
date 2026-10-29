# Sito della Gilda del Grifone Torino

Sito statico con [Astro](https://astro.build). Contenuti in Markdown/JSON, modificabili da `/admin` (Sveltia CMS).

## Sviluppo

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # controllo tipi + build in dist/
```

## Dove sta cosa

| Cosa | Dove |
|---|---|
| Contatti, orari, link Telegram, link CSV della ludoteca | `src/data/site.json` |
| Manuali GdR | `src/data/manuali.json` |
| Resoconti serate / News / Collaborazioni | `src/content/{serate,news,collaborazioni}/*.md` |
| Immagini caricate | bucket R2 `gdg-media` (cartella locale `public/uploads/`, ignorata da git; carica con `npm run media:sync`) |

## Ludoteca (Google Sheet)

La pagina `/giochi-da-tavolo-torino` legge il CSV pubblicato del tab **Elenco Pubblico** (URL in `site.json` → `sheetCsvUrl`) e usa solo le colonne
`ID, TITOLO, CATEGORIA, DESCRIZIONE, ARMADIO, STATUS`. Se il foglio non è raggiungibile usa lo snapshot `/games.json`, generato a ogni build.

**Non pubblicare mai il tab con i dati dei soci** (nome, telefono, mail): un CSV pubblicato è leggibile da chiunque abbia il link.

## Importare i vecchi post

Lo script legge i post dalla API pubblica del vecchio sito WordPress, scarica le immagini in `public/uploads/<collezione>/<slug>/` e crea il file Markdown in `src/content/<collezione>/`.

```sh
npm run import:wp -- https://www.gildadelgrifonetorino.it/eventi-della-serata-lunedi-26-10-2026/
npm run import:wp -- --file links.txt          # un URL per riga, # per i commenti
npm run import:wp -- --collection news <url>   # per le news (default: serate)
npm run import:wp -- --force <url>             # sovrascrive un post già importato
```

I post già importati vengono saltati; un link sbagliato viene segnalato senza fermare gli altri.

## CMS

1. Il repository GitHub è già impostato in `public/admin/config.yml` (`backend.repo`).
2. Prova in locale: `npm run dev`, poi in un secondo terminale `npx @sveltia/cms-proxy` (o usa il pulsante di login locale) e apri `/admin`.
3. In produzione: login GitHub con token personale, oppure un proxy OAuth (es. `sveltia-cms-auth` su Cloudflare Workers) indicato in `backend.base_url`.

## Pubblicazione

Cloudflare Pages o Netlify collegati al repository (comando `npm run build`, cartella `dist`). Ogni salvataggio dal CMS fa un commit e un nuovo deploy.
