export type Rgb = [r: number, g: number, b: number];

export interface Texture {
  path: string;
  width: number;
  height: number;
}

export interface SpriteRef {
  texture: string;
  x: number;
  y: number;
}

export interface Palette {
  texture: string;
  count: number;
}

export type HairMode = 'show' | 'obscured' | 'hide';

export interface HairVariant {
  hairstyle: number | null;
  bald: boolean;
}


export interface HairSprite extends SpriteRef {
  uniqueLeft: boolean;
}

export interface Hairstyle {
  id: number;
  hatOffset: number;
  variants: Record<HairMode, HairVariant>;
}

export interface Accessory {
  id: number;
  sprite: SpriteRef;
  facialHair: boolean;
  belowHair: boolean;
}

interface Item {
  id: string;
  name: string;
  description: string;
  sources: Source[];
}

export interface Ingredient {
  name: string;
  icon: SpriteRef;
}

export interface Tailoring {
  base?: Ingredient;
  items: Ingredient[];
  farmer?: 'male' | 'female';
  random?: boolean;
}

export interface Source {
  where: string;
  cost?: string;
  trade?: { item: Ingredient; amount: number };
  when?: string[];
}

export interface Shirt extends Item {
  sprite: SpriteRef;
  color: Rgb;
  dyeable: boolean;
  prismatic: boolean;
  sleeves: boolean;
  creation: boolean;
  tailoring: Tailoring[];
}

export interface Pants extends Item {
  sprite: SpriteRef;
  color: Rgb;
  dyeable: boolean;
  prismatic: boolean;
  creation: boolean;
  tailoring: Tailoring[];
}

export interface Hat extends Item {
  sprite: SpriteRef;
  hairMode: HairMode;
  skipHairOffset: boolean;
  mask: boolean;
  prismatic: boolean;
  tailoring: Tailoring[];
}

export interface Boots extends Item {
  palette: string;
  colorIndex: number;
}

export interface Catalog {
  gameVersion: string;
  textures: Record<string, Texture>;
  icons: Record<string, Texture>;
  bodies: Record<'male' | 'female', { base: string; bald: string }>;
  skinTones: Palette;
  shoeColors: Palette & { bare: number };
  hairstyles: Hairstyle[];
  hairSprites: Record<string, HairSprite>;
  accessories: Accessory[];
  cloth: Ingredient;
  shirts: Shirt[];
  pants: Pants[];
  hats: Hat[];
  boots: Boots[];
}
