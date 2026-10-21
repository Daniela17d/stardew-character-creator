import type { Catalog } from './catalog/types.ts';
import { fromHex, rgbToBars } from './color.ts';
import presets from './npc-presets.json';
import type { Outfit } from './outfit.ts';

export interface Villager {
  name: string;
  sprite: string;
  gender: string;
  skin: number;
  eyes: string;
  hairstyle: number;
  hairColor: string;
  accessory: number | null;
  hat: string | null;
  shirt: string | null;
  shirtColor: string | null;
  pants: string | null;
  pantsColor: string | null;
  boots: string | null;
}

export const VILLAGERS: Villager[] = presets;

export function villagerOutfit(catalog: Catalog, villager: Villager, current: Outfit): Outfit {
  const find = <T extends { id: string; name: string }>(items: T[], field: string, caption: string | null) => {
    if (caption === null) return undefined;
    const match = /(?:\(([^)]+)\)|ID (\S+))$/.exec(caption);
    const id = match?.[1] ?? match?.[2];
    const item = items.find((entry) => entry.id === id) ?? items.find((entry) => entry.name === caption);
    if (!item) console.warn(`${villager.name}: no ${field} called "${caption}"`);
    return item;
  };
  const shirt = find(catalog.shirts, 'shirt', villager.shirt);
  const pants = find(catalog.pants, 'pants', villager.pants);
  return {
    male: villager.gender !== 'female',
    skin: villager.skin - 1,
    eyeColor: rgbToBars(fromHex(villager.eyes)),
    hairstyle: catalog.hairstyles[villager.hairstyle - 1]?.id ?? current.hairstyle,
    hairColor: rgbToBars(fromHex(villager.hairColor)),
    accessory: villager.accessory === null ? null : villager.accessory - 2,
    hat: find(catalog.hats, 'hat', villager.hat)?.id ?? null,
    shirt: shirt?.id ?? current.shirt,
    shirtColor: villager.shirtColor
      ? rgbToBars(fromHex(villager.shirtColor))
      : shirt
        ? rgbToBars(shirt.color)
        : current.shirtColor,
    pants: pants?.id ?? current.pants,
    pantsColor: villager.pantsColor
      ? rgbToBars(fromHex(villager.pantsColor))
      : pants
        ? rgbToBars(pants.color)
        : current.pantsColor,
    boots: find(catalog.boots, 'boots', villager.boots)?.id ?? null,
  };
}
