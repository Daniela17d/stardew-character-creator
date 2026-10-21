import type { Catalog } from './catalog/types.ts';
import { barsToRgb, rgbToBars, type Bars } from './color.ts';
import type { Parts } from './render/farmer.ts';

export interface Outfit {
  male: boolean;
  skin: number;
  eyeColor: Bars;
  hairstyle: number;
  hairColor: Bars;
  accessory: number | null;
  shirt: string;
  shirtColor: Bars;
  pants: string;
  pantsColor: Bars;
  hat: string | null;
  boots: string | null;
}

export function newFarmer(catalog: Catalog): Outfit {
  return {
    male: true,
    skin: 0,
    eyeColor: rgbToBars([122, 68, 52]),
    hairstyle: 0,
    hairColor: rgbToBars([193, 90, 50]),
    accessory: null,
    shirt: '1000',
    shirtColor: rgbToBars(catalog.shirts.find((shirt) => shirt.id === '1000')?.color ?? [255, 255, 255]),
    pants: '0',
    pantsColor: rgbToBars([46, 85, 183]),
    hat: null,
    boots: null,
  };
}

export function farmerParts(outfit: Outfit): Parts {
  return {
    ...outfit,
    eyeColor: barsToRgb(outfit.eyeColor),
    hairColor: barsToRgb(outfit.hairColor),
    shirtColor: barsToRgb(outfit.shirtColor),
    pantsColor: barsToRgb(outfit.pantsColor),
  };
}
