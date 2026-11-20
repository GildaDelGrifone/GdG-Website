import Papa from 'papaparse';
import { loadSheet, norm } from './sheet';

export interface Game {
  id: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  armadio: string;
  disponibile: boolean;
}

// Solo queste colonne vengono lette: qualsiasi altra (es. dati dei soci) viene scartata.
const COLUMNS = ['ID', 'TITOLO', 'CATEGORIA', 'DESCRIZIONE', 'ARMADIO', 'STATUS'] as const;

export function parseGames(csv: string): Game[] {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return data
    .map((row) => {
      const r = Object.fromEntries(COLUMNS.map((c) => [c, (row[c] ?? '').trim()]));
      return {
        id: r.ID,
        titolo: r.TITOLO,
        categoria: r.CATEGORIA || 'Altro',
        descrizione: r.DESCRIZIONE,
        armadio: r.ARMADIO,
        disponibile: r.STATUS.toLowerCase() === 'disponibile',
      };
    })
    .filter((g) => g.titolo);
}

export function loadGames(url: string, snapshotUrl: string): Promise<Game[]> {
  return loadSheet(url, snapshotUrl, parseGames);
}

export interface Filters {
  query: string;
  categoria: string;
  armadio: string;
  soloDisponibili: boolean;
}

export function filterGames(games: Game[], f: Filters): Game[] {
  const q = norm(f.query.trim());
  return games
    .filter((g) => !q || norm(g.titolo).includes(q) || norm(g.descrizione).includes(q))
    .filter((g) => !f.categoria || g.categoria === f.categoria)
    .filter((g) => !f.armadio || g.armadio === f.armadio)
    .filter((g) => !f.soloDisponibili || g.disponibile)
    .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true }));
}
