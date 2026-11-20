import Papa from 'papaparse';
import { loadSheet, norm } from './sheet';
import { photoSlug } from './photo-slug.js';

export interface Manuale {
  sistema: string;
  titolo: string;
  tipo: string;
  editore: string;
  lingua: string;
  edizione: string;
  copie: number;
  foto: string; // slug della foto principale su R2, '' se manca
}

// Solo queste colonne vengono lette. ID (non stabile) e Note (appunti interni di catalogazione) restano fuori di proposito.
const COLUMNS = ['Sistema', 'Manuale/Prodotto', 'Tipo', 'Editore', 'Lingua', 'Edizione', 'Copie', 'File foto'] as const;

// Ordine dei tipi usato dal catalogo all'interno di un sistema.
export const TIPI = [
  'Manuale base',
  'Scatola',
  'Schermo del Master',
  'Supplemento',
  'Ambientazione',
  'Avventura',
  'Accessorio',
  'Librogame',
  'Altro',
];

const MEDIA = 'https://media.gildadelgrifonetorino.it/gdr';

export function photoUrl(slug: string, size: 'thumb' | 'full'): string {
  return size === 'thumb' ? `${MEDIA}/thumb/${slug}.webp` : `${MEDIA}/${slug}.webp`;
}

// Le righe restano nell'ordine del foglio: per sistema (edizioni in ordine cronologico), poi per tipo e nome.
export function parseManuali(csv: string): Manuale[] {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return data
    .map((row) => {
      const r = Object.fromEntries(COLUMNS.map((c) => [c, (row[c] ?? '').trim()]));
      const prima = r['File foto'].split('\n')[0].trim();
      return {
        sistema: r.Sistema,
        titolo: r['Manuale/Prodotto'],
        tipo: r.Tipo || 'Altro',
        editore: r.Editore,
        lingua: r.Lingua,
        edizione: r.Edizione,
        copie: Math.max(1, parseInt(r.Copie, 10) || 1),
        foto: prima ? photoSlug(prima) : '',
      };
    })
    .filter((m) => m.titolo);
}

export function loadManuali(url: string, snapshotUrl: string): Promise<Manuale[]> {
  return loadSheet(url, snapshotUrl, parseManuali);
}

export interface Filters {
  query: string;
  sistema: string;
  tipo: string;
  lingua: string;
}

export function filterManuali(list: Manuale[], f: Filters): Manuale[] {
  const q = norm(f.query.trim());
  return list
    .filter((m) => !q || norm(`${m.sistema} ${m.titolo} ${m.editore}`).includes(q))
    .filter((m) => !f.sistema || m.sistema === f.sistema)
    .filter((m) => !f.tipo || m.tipo === f.tipo)
    .filter((m) => !f.lingua || m.lingua === f.lingua);
}
