import type { Catalog } from './types.ts';

export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${import.meta.env.BASE_URL}assets/catalog.json`);
  if (!response.ok) throw new Error(`Could not load the catalogue (HTTP ${response.status})`);
  return (await response.json()) as Catalog;
}
