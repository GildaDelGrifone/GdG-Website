import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.gildadelgrifonetorino.it',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
