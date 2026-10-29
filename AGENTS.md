# Gilda del Grifone website: context for AI agents

Static website for **Gilda del Grifone**, a board-game / TTRPG association in Turin, Italy. Live at https://www.gildadelgrifonetorino.it (replaced an old WordPress site).
Astro 5, TypeScript strict, no UI framework, Italian UI (`lang="it"`). User-facing text and code comments are in Italian; keep that.
`README.md` is the human (Italian) guide; this file holds the rules that are not obvious from the code.

## Commands
- `npm run dev` (http://localhost:4321), `npm run build` (writes `dist/`), `npm run check` (`astro check`; needs Node 22, crashes on Node 20.18).
- `npm run import:wp -- <url|file.txt>` imports old WordPress posts. `npm run media:sync` uploads `public/uploads/` to R2 (needs `.bucketkey`).
- There is no test suite. Verify a change with `npm run build`, then inspect the affected files in `dist/`.

## Code map
- `src/pages/`: `index`, `chi-siamo`, `gioco-di-ruolo-torino`, `giochi-da-tavolo-torino`, `collaborazioni`, `404`, `news/`, `serate/` (`[slug]` + paginated `[...page]`, 12 per page), `rss.xml.ts`, `games.json.ts` (build-time snapshot of the games list).
- `src/layouts/BaseLayout.astro`: head, SEO, Open Graph/Twitter, JSON-LD. Props: `title`, `seoTitle`, `description`, `image`, `schema`, `type`, `published`, `noindex`, `breadcrumbs`.
- `src/lib/`: `urls.ts` (article URLs), `schema.ts` (schema.org nodes), `images.ts` (`imageSize`, reads local files or fetches remote ones at build time, cached).
- `src/scripts/game-library.ts`: client-side games library (CSV parsing, filters).
- `src/components/`: Header, Footer, OpeningHours, TelegramButton, ArticleCard.
- `src/data/`: `site.json`, `manuali.json`, `chi-siamo.json`. `src/styles/global.css` holds the design tokens (CSS variables).
- `src/content/{serate,news,collaborazioni}/*.md`, validated by `src/content.config.ts` (Zod).
- `public/admin/` is the Sveltia CMS (`config.yml`, pinned in `index.html`). `wrangler.jsonc` is the Cloudflare config.

## Content model
- `serate`: `title`, `date`, `cover?`, `excerpt?`, `tavoli?` (list of `{gioco, tipo: 'gdr'|'tavolo', immagine?}`), Markdown body. File name `YYYY-MM-DD-<slug>.md`.
- `news`: same without `tavoli`. File name `YYYY-MM-<slug>.md`.
- `collaborazioni`: `nome`, `logo`, `url?`, `descrizione`, `ordine` (default 100). The collection is currently empty, which only causes a harmless build warning.

## Rules that are not obvious
- **Article URLs have no date**: `/serate/<slug>/`, `/news/<slug>/`. Always go through `articleSlug`, `articlePath` and `articleStaticPaths` in `src/lib/urls.ts`; never build links from `entry.id`. The build fails on duplicate slugs. The owner decided not to add redirects for old WordPress or dated URLs, so don't add any.
- **SEO**: Home, Chi siamo, Gioco di ruolo and Ludoteca keep the old WordPress titles and descriptions via `seoTitle`/`description`; they were chosen deliberately, so don't reword them. The canonical host is `https://www.gildadelgrifonetorino.it` (the bare domain redirects there). Structured data comes from `src/lib/schema.ts` and is built from `site.json`.
- **Single source for facts**: address, phone, email, Telegram link and opening hours live only in `src/data/site.json`. The home page, footer, "open now" widget and JSON-LD read from it, so don't hardcode them.
- **Privacy**: the games library reads the published CSV of the Google Sheet tab "Elenco Pubblico" (`site.json` → `sheetCsvUrl`), and only the whitelisted columns `ID, TITOLO, CATEGORIA, DESCRIZIONE, ARMADIO, STATUS` (`parseGames`). The other tabs hold member data (name, phone, mail). Never publish them and never widen the whitelist.
- **Images** live in the Cloudflare R2 bucket `gdg-media`, served at `https://media.gildadelgrifonetorino.it`. Posts reference them by absolute URL. `public/uploads/` is git-ignored staging only. Never commit images; add them through the CMS (R2 media library, folder `cms/`) or the import script plus `npm run media:sync`.
- **Dates** are rendered with `timeZone: 'UTC'` so the day never shifts.
- **Secrets**: never commit `.bucketkey` or `.env`. The R2 Access Key ID and account ID in `public/admin/config.yml` are public by design. The secret key exists only in `.bucketkey` and in editors' browsers.
- **Git**: commit messages carry no AI co-author trailer. Don't push unless asked.
- Keep changes small and in the existing style. Avoid new dependencies unless there is no simple alternative.

## Infrastructure
- GitHub: organization `GildaDelGrifone`, repo `GdG-Website`, branch `main`. Every push deploys.
- Hosting: Cloudflare Workers static assets (`wrangler.jsonc`). Build `npm run build`, deploy `npx wrangler deploy`, `NODE_VERSION=22`.
- Domain registered at OVH, DNS on Cloudflare (Free plan). Custom domains: `www.` (canonical), the bare domain (redirect rule to `www`), `media.` (R2). Always Use HTTPS on, minimum TLS 1.2, HSTS intentionally off for now.
- Mail DNS records are the old Serverlet ones and must stay "DNS only", never proxied.
- CMS: Sveltia at `/admin`, GitHub backend (`main`). The default "Login with GitHub" button fails because it goes through Netlify, so editors sign in with a fine-grained token (or an OAuth proxy in `backend.base_url`). Image uploads need the bucket's CORS rule for the production origin.

## Related repo
`GdG-Event-Bot` (Telegram bot) writes `src/content/serate/<YYYY-MM-DD>-<slug>.md` on a `serata/<slug>` branch (draft) and merges it into `main` on "Pubblica". Its front matter must keep matching `src/content.config.ts`. If you change that schema, tell the user the bot needs updating too.

## How to
- **New page**: add `src/pages/<name>.astro` using `BaseLayout` with a `title`/`description` (or `seoTitle`), add it to `Header.astro`, and check it appears in `dist/sitemap-0.xml`.
- **New content collection**: define it in `src/content.config.ts`, add it to `public/admin/config.yml`, and create the list and `[slug]` pages. Use `src/lib/urls.ts` for the URLs.
- **Change opening hours or contacts**: edit `src/data/site.json` only.
- **Import old posts**: `npm run import:wp -- --collection serate scripts/links_serate.txt`, then `npm run media:sync`.

## Decisions and gotchas
- Chosen over alternatives: a static site (cheap, fast, no PHP to maintain); R2 for media (the repo would otherwise exceed GitHub's size comfort); Cloudflare for DNS and hosting (free).
- `/gallery/` and the old WordPress event URLs were intentionally not kept.
- `astro check` needs Node 22; the build itself works on Node 20.
- Media URLs on R2 get no automatic `width`/`height` from Astro, so `imageSize()` reads them at build time to avoid layout shift. Images inside Markdown bodies don't get dimensions.

## Before you say it's done
`npm run build` passes, the affected pages in `dist/` look right (title, description, canonical, links), and `README.md` and this file are updated if the behaviour they describe changed.
