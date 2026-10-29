import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type Size = { width?: number; height?: number };

// Una sola richiesta per URL durante la build (card e pagina articolo usano la stessa immagine).
const cache = new Map<string, Promise<Size>>();

async function read(src: string): Promise<Size> {
  const buf = /^https?:\/\//.test(src)
    ? Buffer.from(await (await fetch(src)).arrayBuffer())
    : await readFile(path.join('public', decodeURIComponent(src)));
  const { width, height } = await sharp(buf).metadata();
  return { width, height };
}

// Dimensioni di un'immagine locale in public/ ("/x.jpg") o remota (bucket R2), per evitare layout shift.
// In caso di errore restituisce {}: l'<img> funziona comunque, senza width/height.
export function imageSize(src?: string): Promise<Size> {
  if (!src) return Promise.resolve({});
  if (!cache.has(src)) cache.set(src, read(src).catch(() => ({})));
  return cache.get(src)!;
}
