// Caricamento di un CSV pubblicato da Google Sheet, con lo snapshot di build come riserva.
export async function loadSheet<T>(url: string, snapshotUrl: string, parse: (csv: string) => T[]): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parse(await res.text());
  } catch {
    const res = await fetch(snapshotUrl);
    if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
    return (await res.json()) as T[];
  }
}

// Minuscole e senza accenti, per le ricerche.
export const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
