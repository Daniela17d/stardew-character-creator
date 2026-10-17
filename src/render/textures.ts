import type { Catalog } from '../catalog/types.ts';
import type { Pixels } from './pixels.ts';

export async function loadTextures(catalog: Catalog): Promise<Record<string, Pixels>> {
  const entries = await Promise.all(
    Object.entries(catalog.textures).map(
      async ([key, texture]) => [key, await loadPixels(`${import.meta.env.BASE_URL}${texture.path}`)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function loadPixels(url: string): Promise<Pixels> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}
