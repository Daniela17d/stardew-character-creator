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
}

export interface Shirt extends Item {
  sprite: SpriteRef;
  color: Rgb;
  dyeable: boolean;
  prismatic: boolean;
  sleeves: boolean;
  creation: boolean;
}

export interface Pants extends Item {
  sprite: SpriteRef;
  color: Rgb;
  dyeable: boolean;
  prismatic: boolean;
  creation: boolean;
}

export interface Hat extends Item {
  sprite: SpriteRef;
  hairMode: HairMode;
  skipHairOffset: boolean;
  mask: boolean;
  prismatic: boolean;
}

export interface Boots extends Item {
  palette: string;
  colorIndex: number;
}

export interface Catalog {
  gameVersion: string;
  textures: Record<string, Texture>;
  bodies: Record<'male' | 'female', { base: string; bald: string }>;
  skinTones: Palette;
  shoeColors: Palette & { bare: number };
  hairstyles: Hairstyle[];
  hairSprites: Record<string, HairSprite>;
  accessories: Accessory[];
  shirts: Shirt[];
  pants: Pants[];
  hats: Hat[];
  boots: Boots[];
}
