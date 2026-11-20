// Nome del file su R2 a partire dal nome della foto originale.
// Usato sia dal sito sia da scripts/photos.mjs: le due parti devono produrre lo stesso slug.
// "Alice è Scomparsa - Un Gioco (2).jpg" → "alice-e-scomparsa-un-gioco-2"

/** @param {string} filename */
export function photoSlug(filename) {
  return filename
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
