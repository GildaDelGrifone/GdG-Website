import type { APIRoute } from 'astro';
import { parseManuali } from '../scripts/rpg-library';
import site from '../data/site.json';

// Snapshot generato in fase di build: usato dal catalogo GdR se il Google Sheet non è raggiungibile.
export const GET: APIRoute = async () => {
  let manuali: unknown[] = [];
  try {
    const res = await fetch(site.gdrCsvUrl);
    if (res.ok) manuali = parseManuali(await res.text());
  } catch {
    // build offline: snapshot vuoto
  }
  return new Response(JSON.stringify(manuali), { headers: { 'Content-Type': 'application/json' } });
};
