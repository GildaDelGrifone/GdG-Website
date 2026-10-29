import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articolo = z.object({
  title: z.string(),
  date: z.coerce.date(),
  cover: z.string().optional(),
  excerpt: z.string().optional(),
});

const serate = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/serate' }),
  schema: articolo.extend({
    tavoli: z
      .array(
        z.object({
          gioco: z.string(),
          tipo: z.enum(['gdr', 'tavolo']),
          link: z.string().url().optional(),
          immagine: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: articolo,
});

const collaborazioni = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/collaborazioni' }),
  schema: z.object({
    nome: z.string(),
    logo: z.string(),
    url: z.string().url().optional(),
    descrizione: z.string(),
    ordine: z.number().default(100),
  }),
});

export const collections = { serate, news, collaborazioni };
