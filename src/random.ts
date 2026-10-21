import type { Catalog, Rgb } from './catalog/types.ts';
import { rgbToBars } from './color.ts';
import type { Outfit } from './outfit.ts';

const MALE_EXCLUDED_SHIRTS = new Set([
  '1056', '1057', '1070', '1046', '1040', '1060', '1090', '1051',
  '1082', '1107', '1080', '1083', '1092', '1072', '1076', '1041',
]);
const TAN: Rgb = [210, 180, 140];
const PANTS_FOR_SHIRT: [number[], Rgb][] = [
  [[50], [226, 133, 160]],
  [[0, 7, 71], [34, 29, 173]],
  [[68, 88], [119, 215, 130]],
  [[67, 72], [108, 134, 224]],
  [[79, 99, 103], [55, 55, 60]],
];

export function randomOutfit(catalog: Catalog, outfit: Outfit): Outfit {
  const accessory = randomAccessory(outfit);

  let skin = next(0, 6);
  if (chance(0.15)) skin = next(0, 24);

  const hairstyle = outfit.male ? (coin() ? next(0, 16) : next(108, 118)) : next(16, 41);
  let hair = randomColor();
  if (coin()) hair = hair.map((channel) => Math.floor(channel / 2)) as Rgb;
  hair = lowChannels(hair);
  if (coin()) {
    hair = warmer(hair);
    hair[0] = Math.min(255, hair[0] + 50);
    hair[1] = Math.min(255, hair[1] + 50);
  } else if (chance(0.33)) hair = [next(80, 130), next(35, 70), 0];
  if (hair.every((channel) => channel < 100) && chance(0.8)) {
    hair = hair.map((channel, i) => (coin() ? Math.max(channel, TAN[i]) : Math.floor((channel + TAN[i]) / 2))) as Rgb;
  }
  if (((skin >= 4 && skin <= 8 && skin !== 7) || skin === 14) && chance(0.5)) hair = [next(50, 100), next(25, 40), 0];

  const shirts = catalog.shirts.filter((item) => !(outfit.male && MALE_EXCLUDED_SHIRTS.has(item.id)));
  const shirt = shirts[next(0, shirts.length)];
  const shirtIndex = (shirt.sprite.y / 32) * 16 + shirt.sprite.x / 8;
  const shirtColor = shirt.dyeable && coin() ? clothesColor() : shirt.color;

  let pants = clothesColor();
  pants = PANTS_FOR_SHIRT.find(([indexes]) => indexes.includes(shirtIndex))?.[1] ?? pants;

  let eyes = randomColor().map((channel) => Math.floor(channel / 2)) as Rgb;
  eyes = lowChannels(eyes);
  if (coin()) eyes = warmer(eyes);

  return {
    ...outfit,
    accessory,
    skin,
    hairstyle,
    hairColor: rgbToBars(hair),
    shirt: shirt.id,
    shirtColor: rgbToBars(shirtColor),
    pants: catalog.pants[next(0, catalog.pants.length)].id,
    pantsColor: rgbToBars(pants),
    eyeColor: rgbToBars(eyes),
    hat: coin() ? catalog.hats[next(0, catalog.hats.length)].id : null,
    boots: coin() ? catalog.boots[next(0, catalog.boots.length)].id : null,
  };
}

function clothesColor(): Rgb {
  let color = randomColor();
  if (coin()) color = color.map((channel) => Math.floor(channel / 2)) as Rgb;
  return lowChannels(color);
}

function randomAccessory(outfit: Outfit): number | null {
  if (!chance(0.33)) return null;
  if (outfit.male) {
    if (chance(0.33)) return chance(0.8) ? next(0, 7) : next(19, 21);
    if (chance(0.33)) return pick(25, 14, 17, 10, 9);
    if (chance(0.1)) return next(0, 19);
    return outfit.accessory;
  }
  if (chance(0.33)) return next(6, 19);
  if (chance(0.5)) return pick(23, 27, 28);
  return pick(25, 14, 17, 10, 9);
}

function randomColor(): Rgb {
  return [next(25, 254), next(25, 254), next(25, 254)];
}

function lowChannels(color: Rgb): Rgb {
  return color.map((channel) => (coin() ? next(15, 50) : channel)) as Rgb;
}

function warmer([red, green, blue]: Rgb): Rgb {
  if (blue > red) blue = Math.max(0, blue - 50);
  if (blue > green) blue = Math.max(0, blue - 50);
  if (green > red) green = Math.max(0, red - 50);
  return [red, green, blue];
}

function next(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function coin(): boolean {
  return chance(0.5);
}

function pick(...options: number[]): number {
  return options[next(0, options.length)];
}
