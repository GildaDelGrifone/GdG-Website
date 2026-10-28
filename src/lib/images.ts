import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Dimensioni di un'immagine in public/ (es. "/uploads/serate/x/foto.jpg"), per evitare layout shift.
// Restituisce {} per URL esterni o file illeggibili: l'<img> funziona comunque, senza width/height.
export async function imageSize(src?: string): Promise<{ width?: number; height?: number }> {
  if (!src?.startsWith('/')) return {};
  try {
    const { width, height } = await sharp(await readFile(path.join('public', decodeURIComponent(src)))).metadata();
    return { width, height };
  } catch {
    return {};
  }
}
