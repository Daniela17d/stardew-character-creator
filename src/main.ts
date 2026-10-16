import { loadCatalog } from './catalog/load.ts';

// Placeholder until the renderer exists: shows what the catalogue contains.
const app = document.querySelector<HTMLDivElement>('#app')!;
const catalog = await loadCatalog();

const heading = document.createElement('h1');
heading.textContent = 'Stardew Character Creator';
const source = document.createElement('p');
source.textContent = `Data from Stardew Valley ${catalog.gameVersion}`;

const list = document.createElement('ul');
for (const [label, count] of [
  ['Hairstyles', catalog.hairstyles.length],
  ['Accessories', catalog.accessories.length],
  ['Skin tones', catalog.skinTones.count],
  ['Shirts', catalog.shirts.length],
  ['Pants', catalog.pants.length],
  ['Hats', catalog.hats.length],
  ['Boots', catalog.boots.length],
] as const) {
  const item = document.createElement('li');
  item.textContent = `${label}: ${count}`;
  list.append(item);
}

app.append(heading, source, list);
