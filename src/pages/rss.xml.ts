import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';
import { articlePath } from '../lib/urls';

export async function GET(context: APIContext) {
  const [serate, news] = await Promise.all([getCollection('serate'), getCollection('news')]);
  const items = [
    ...serate.map((e) => ({ ...e.data, link: articlePath('serate', e) })),
    ...news.map((e) => ({ ...e.data, link: articlePath('news', e) })),
  ]
    .sort((a, b) => b.date.valueOf() - a.date.valueOf())
    .map((e) => ({ title: e.title, pubDate: e.date, description: e.excerpt ?? '', link: e.link }));

  return rss({
    title: site.name,
    description: site.description,
    site: context.site!,
    items,
  });
}
