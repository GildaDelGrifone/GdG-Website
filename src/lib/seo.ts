import site from '../data/site.json';

const MAX_TITLE = 60;
const MIN_DESC = 70;
const MAX_DESC = 160;

// Il nome del sito si aggiunge solo se il titolo resta leggibile nei risultati di Google (oltre ~60 caratteri viene tagliato).
export function pageTitle(title: string | undefined, seoTitle?: string): string {
  if (seoTitle) return seoTitle;
  if (!title) return site.name;
  const withSite = `${title} · ${site.name}`;
  return withSite.length <= MAX_TITLE ? withSite : title;
}

// Descrizioni troppo corte vengono completate, quelle troppo lunghe tagliate a fine parola.
export function metaDescription(description: string): string {
  let text = description.replace(/\s+/g, ' ').trim();
  if (text.length < MIN_DESC) {
    text = `${text.replace(/[.\s]+$/, '')}. ${site.name}: giochi da tavolo e di ruolo a Torino.`;
  }
  if (text.length > MAX_DESC) {
    text = text.slice(0, MAX_DESC - 1).replace(/\s+\S*$/, '') + '…';
  }
  return text;
}
