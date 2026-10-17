import type { Catalog, Rgb } from './catalog/types.ts';

export interface Outfit {
  male: boolean;
  skin: number;
  eyeColor: Rgb;
  hairstyle: number;
  hairColor: Rgb;
  accessory: number | null;
  shirt: string;
  shirtColor: Rgb;
  pants: string;
  pantsColor: Rgb;
  hat: string | null;
  boots: string | null;
}

export function newFarmer(catalog: Catalog): Outfit {
  return {
    male: true,
    skin: 0,
    eyeColor: [122, 68, 52],
    hairstyle: 0,
    hairColor: [193, 90, 50],
    accessory: null,
    shirt: '1000',
    shirtColor: catalog.shirts.find((shirt) => shirt.id === '1000')?.color ?? [255, 255, 255],
    pants: '0',
    pantsColor: [46, 85, 183],
    hat: null,
    boots: null,
  };
}
