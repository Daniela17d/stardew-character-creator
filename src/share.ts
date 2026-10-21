import type { Catalog } from './catalog/types.ts';
import { BAR_MAX, rgbToBars, type Bars } from './color.ts';
import { BUTTON, whenChanged, type ViewState } from './controls.ts';
import { farmerParts, newFarmer, type Outfit } from './outfit.ts';
import type { FarmerRenderer } from './render/farmer.ts';

const EXPORT_SCALE = 4;

export function outfitParams(catalog: Catalog, outfit: Outfit): URLSearchParams {
  const base = newFarmer(catalog);
  const params = new URLSearchParams();
  const set = (key: string, value: string, fallback: string) => {
    if (value !== fallback) params.set(key, value);
  };
  set('g', outfit.male ? 'm' : 'f', 'm');
  set('sk', String(outfit.skin + 1), String(base.skin + 1));
  set('e', outfit.eyeColor.join('-'), base.eyeColor.join('-'));
  set('h', String(outfit.hairstyle), String(base.hairstyle));
  set('hc', outfit.hairColor.join('-'), base.hairColor.join('-'));
  if (outfit.accessory !== null) params.set('a', String(outfit.accessory));
  set('s', outfit.shirt, base.shirt);
  const shirt = catalog.shirts.find((item) => item.id === outfit.shirt);
  if (shirt?.dyeable) set('sc', outfit.shirtColor.join('-'), rgbToBars(shirt.color).join('-'));
  set('p', outfit.pants, base.pants);
  if (catalog.pants.find((item) => item.id === outfit.pants)?.dyeable) {
    set('pc', outfit.pantsColor.join('-'), base.pantsColor.join('-'));
  }
  if (outfit.hat !== null) params.set('ht', outfit.hat);
  if (outfit.boots !== null) params.set('b', outfit.boots);
  return params;
}

export function outfitFromParams(catalog: Catalog, params: URLSearchParams): Outfit {
  const outfit = newFarmer(catalog);
  if (params.get('g') === 'f') outfit.male = false;
  const skin = Number(params.get('sk'));
  if (Number.isInteger(skin) && skin >= 1 && skin <= catalog.skinTones.count) outfit.skin = skin - 1;
  outfit.eyeColor = parseBars(params.get('e')) ?? outfit.eyeColor;
  const hair = catalog.hairstyles.find((style) => String(style.id) === params.get('h'));
  if (hair) outfit.hairstyle = hair.id;
  outfit.hairColor = parseBars(params.get('hc')) ?? outfit.hairColor;
  const accessory = catalog.accessories.find((item) => String(item.id) === params.get('a'));
  if (accessory) outfit.accessory = accessory.id;
  const shirt = catalog.shirts.find((item) => item.id === params.get('s'));
  if (shirt) {
    outfit.shirt = shirt.id;
    outfit.shirtColor = rgbToBars(shirt.color);
  }
  outfit.shirtColor = parseBars(params.get('sc')) ?? outfit.shirtColor;
  const pants = catalog.pants.find((item) => item.id === params.get('p'));
  if (pants) outfit.pants = pants.id;
  outfit.pantsColor = parseBars(params.get('pc')) ?? outfit.pantsColor;
  outfit.hat = catalog.hats.find((item) => item.id === params.get('ht'))?.id ?? null;
  outfit.boots = catalog.boots.find((item) => item.id === params.get('b'))?.id ?? null;
  return outfit;
}

export function syncUrl(catalog: Catalog, state: ViewState): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return whenChanged(
    () => [state.outfit],
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => history.replaceState(null, '', shareLink(catalog, state.outfit)), 400);
    },
  );
}

export function createShareControls(catalog: Catalog, state: ViewState, renderer: FarmerRenderer): HTMLElement {
  const native = 'share' in navigator && matchMedia('(pointer: coarse)').matches;
  const controls = document.createElement('div');
  controls.className = 'flex gap-2';

  const download = shareButton('Download PNG');
  download.addEventListener('click', async () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await farmerPng(renderer, state));
    link.download = 'stardew-farmer.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  const label = native ? 'Share' : 'Copy link';
  const share = shareButton(label);
  share.addEventListener('click', async () => {
    const url = new URL(shareLink(catalog, state.outfit), location.href).href;
    if (native) {
      await navigator.share({ title: 'My Stardew Valley farmer', url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    share.textContent = 'Copied';
    setTimeout(() => (share.textContent = label), 1500);
  });

  controls.append(download, share);
  return controls;
}

function shareLink(catalog: Catalog, outfit: Outfit): string {
  const query = outfitParams(catalog, outfit).toString();
  return query ? `${location.pathname}?${query}` : location.pathname;
}

function parseBars(text: string | null): Bars | undefined {
  const bars = text?.split('-').map(Number);
  if (bars?.length !== 3 || bars.some((bar) => !Number.isInteger(bar) || bar < 0)) return undefined;
  return bars.map((bar) => Math.min(BAR_MAX, bar)) as Bars;
}

async function farmerPng(renderer: FarmerRenderer, state: ViewState): Promise<Blob> {
  const surface = renderer.render(farmerParts(state.outfit), state.direction);
  const pixels = new ImageData(surface.toStraightAlpha(), surface.width, surface.height);
  let [left, top, right, bottom] = [surface.width, surface.height, 0, 0];
  for (let y = 0; y < surface.height; y++) {
    for (let x = 0; x < surface.width; x++) {
      if (!pixels.data[(y * surface.width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  const frame = new OffscreenCanvas(surface.width, surface.height);
  frame.getContext('2d')!.putImageData(pixels, 0, 0);
  const image = new OffscreenCanvas((right - left) * EXPORT_SCALE, (bottom - top) * EXPORT_SCALE);
  const context = image.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(frame, left, top, right - left, bottom - top, 0, 0, image.width, image.height);
  return image.convertToBlob({ type: 'image/png' });
}

function shareButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `px-3 py-1 text-sm font-semibold ${BUTTON}`;
  button.textContent = text;
  return button;
}
