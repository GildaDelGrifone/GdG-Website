import Papa from 'papaparse';

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

export async function loadGames(url: string, snapshotUrl: string): Promise<Game[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseGames(await res.text());
  } catch {
    const res = await fetch(snapshotUrl);
    if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
    return (await res.json()) as Game[];
  }
}

export interface Filters {
  query: string;
  categoria: string;
  armadio: string;
  soloDisponibili: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/g, '').toLowerCase();

export function filterGames(games: Game[], f: Filters): Game[] {
  const q = norm(f.query.trim());
  return games
    .filter((g) => !q || norm(g.titolo).includes(q) || norm(g.descrizione).includes(q))
    .filter((g) => !f.categoria || g.categoria === f.categoria)
    .filter((g) => !f.armadio || g.armadio === f.armadio)
    .filter((g) => !f.soloDisponibili || g.disponibile)
    .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true }));
}
