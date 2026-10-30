import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeImageSize from './src/lib/rehype-image-size.ts';

export default defineConfig({
  site: 'https://www.gildadelgrifonetorino.it',
  markdown: { rehypePlugins: [rehypeImageSize] },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
