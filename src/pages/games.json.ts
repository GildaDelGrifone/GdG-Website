import type { APIRoute } from 'astro';
import { parseGames } from '../scripts/game-library';
import site from '../data/site.json';

// Snapshot generato in fase di build: usato dalla ludoteca se il Google Sheet non è raggiungibile.
export const GET: APIRoute = async () => {
  let games: unknown[] = [];
  try {
    const res = await fetch(site.sheetCsvUrl);
    if (res.ok) games = parseGames(await res.text());
  } catch {
    // build offline: snapshot vuoto
  }
  return new Response(JSON.stringify(games), { headers: { 'Content-Type': 'application/json' } });
};
