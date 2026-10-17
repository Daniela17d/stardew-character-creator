import type { Boots, Catalog, Hairstyle, Hat, Pants, Rgb, Shirt } from '../catalog/types.ts';
import { FEATURE_X_OFFSET, FEATURE_Y_OFFSET, IDLE, type AnimationFrame, type Direction } from './animation.ts';
import { SCALE, Surface, WHITE, type DrawOptions, type Pixels, type Rect } from './pixels.ts';

export const FRAME_WIDTH = 80;
export const FRAME_HEIGHT = 144;
export const BODY_X = 8;
export const BODY_Y = 16;

export interface Parts {
  male: boolean;
  skin: number;
  eyeColor: Rgb;
  hairstyle?: number | null;
  hairColor?: Rgb;
  accessory?: number | null;
  shirt?: string | null;
  shirtColor?: Rgb;
  pants?: string | null;
  pantsColor?: Rgb;
  hat?: string | null;
  boots?: string | null;
}

const Layer = {
  base: 2,
  pants: 3,
  shirt: 6,
  shirtDye: 6.5,
  accessoryUnderHair: 7,
  armsUp: 8,
  hatMaskUp: 9,
  hair: 10,
  accessory: 11,
  hat: 12,
  arms: 14,
} as const;

const SLEEVE_KEYS = [256, 257, 258];
const SKIN_KEYS = [260, 261, 262];
const SHOE_KEYS = [268, 269, 270, 271];
const EYE_KEYS = [276, 277];

const SHIRT_ROW: Record<Direction, number> = { down: 0, right: 8, left: 16, up: 24 };
const HAT_ROW: Record<Direction, number> = { down: 0, right: 20, left: 40, up: 60 };
const FRAME_CELL: Rect = { x: 0, y: 0, width: 16, height: 32 };

const PRISMATIC_COLORS: Rgb[] = [
  [255, 0, 0],
  [255, 120, 0],
  [255, 217, 0],
  [0, 255, 0],
  [0, 255, 255],
  [238, 130, 238],
];

type Rgba = [number, number, number, number];

interface Draw {
  layer: number;
  source: Pixels;
  rect: Rect;
  x: number;
  y: number;
  options?: DrawOptions;
}

export class FarmerRenderer {
  private readonly catalog: Catalog;
  private readonly textures: Record<string, Pixels>;
  private readonly hairstyles: Map<number, Hairstyle>;
  private readonly shirts: Map<string, Shirt>;
  private readonly pants: Map<string, Pants>;
  private readonly hats: Map<string, Hat>;
  private readonly boots: Map<string, Boots>;

  constructor(catalog: Catalog, textures: Record<string, Pixels>) {
    this.catalog = catalog;
    this.textures = textures;
    this.hairstyles = new Map(catalog.hairstyles.map((item) => [item.id, item]));
    this.shirts = new Map(catalog.shirts.map((item) => [item.id, item]));
    this.pants = new Map(catalog.pants.map((item) => [item.id, item]));
    this.hats = new Map(catalog.hats.map((item) => [item.id, item]));
    this.boots = new Map(catalog.boots.map((item) => [item.id, item]));
  }

  isAnimated(parts: Parts): boolean {
    const prismatic = (items: Map<string, { prismatic: boolean }>, id: string | null | undefined) =>
      id != null && !!items.get(id)?.prismatic;
    return prismatic(this.shirts, parts.shirt) || prismatic(this.pants, parts.pants) || prismatic(this.hats, parts.hat);
  }

  render(parts: Parts, direction: Direction = 'down', animation: AnimationFrame = IDLE[direction], time = 0): Surface {
    const style = parts.hairstyle == null ? undefined : this.get(this.hairstyles, parts.hairstyle);
    const shirt = parts.shirt == null ? undefined : this.get(this.shirts, parts.shirt);
    const pants = parts.pants == null ? undefined : this.get(this.pants, parts.pants);
    const hat = parts.hat == null ? undefined : this.get(this.hats, parts.hat);
    const boots = parts.boots == null ? undefined : this.get(this.boots, parts.boots);
    const accessory = parts.accessory == null ? undefined : this.catalog.accessories[parts.accessory];
    const hairColor = parts.hairColor ?? WHITE;
    const shirtColor = parts.shirtColor ?? shirt?.color ?? WHITE;
    const variant = style?.variants[hat?.hairMode ?? 'show'];
    const texture = this.catalog.bodies[parts.male ? 'male' : 'female'][variant?.bald ? 'bald' : 'base'];
    const colors = this.bodyColors(texture, parts, shirt, shirt?.prismatic ? prismaticColor(0) : shirtColor, boots);

    const { frame, flip } = animation;
    const sprite: Rect = { x: (frame * 16) % 96, y: Math.floor((frame * 16) / 96) * 32, width: 16, height: 32 };
    const x = BODY_X + animation.xOffset * SCALE;
    const y = BODY_Y + animation.positionOffset * SCALE;
    const featureX = FEATURE_X_OFFSET[frame] * SCALE;
    const featureY = FEATURE_Y_OFFSET[frame] * SCALE;
    const sideX = direction === 'left' ? -featureX : featureX;
    const heightOffset = parts.male ? 0 : 4;
    const draws: Draw[] = [];

    draws.push({ layer: Layer.base, source: this.recolor(texture, sprite, colors), rect: FRAME_CELL, x, y, options: { flip } });

    if (pants) {
      draws.push({
        layer: Layer.pants,
        source: this.textures[pants.sprite.texture],
        rect: { ...sprite, x: sprite.x + pants.sprite.x + (parts.male ? 0 : 96), y: sprite.y + pants.sprite.y },
        x,
        y,
        options: { flip, tint: pants.prismatic ? prismaticColor(time) : (parts.pantsColor ?? pants.color) },
      });
    }

    if (shirt) {
      const source = this.textures[shirt.sprite.texture];
      const rect: Rect = { x: shirt.sprite.x, y: shirt.sprite.y + SHIRT_ROW[direction], width: 8, height: 8 };
      const shirtX = x + 16 + sideX;
      const shirtY = y + 56 + featureY + heightOffset;
      draws.push({ layer: Layer.shirt, source, rect, x: shirtX, y: shirtY });
      draws.push({
        layer: Layer.shirtDye,
        source,
        rect: { ...rect, x: rect.x + 128 },
        x: shirtX,
        y: shirtY,
        options: { tint: shirt.prismatic ? prismaticColor(time) : shirtColor },
      });
    }

    if (accessory && direction !== 'up') {
      draws.push({
        layer: accessory.belowHair ? Layer.accessoryUnderHair : Layer.accessory,
        source: this.textures[accessory.sprite.texture],
        rect: { x: accessory.sprite.x, y: accessory.sprite.y + (direction === 'down' ? 0 : 16), width: 16, height: 16 },
        x: x + sideX,
        y: y + 4 + featureY + heightOffset,
        options: { flip: direction === 'left', tint: accessory.facialHair ? hairColor : WHITE },
      });
    }

    if (style && variant && variant.hairstyle !== null) {
      const hair = this.catalog.hairSprites[variant.hairstyle];
      const row = { down: 0, right: 32, up: 64, left: hair.uniqueLeft ? 96 : 32 }[direction];
      const offsetY =
        direction === 'up' ? 4 + hairOffset(parts.male, variant.hairstyle) : hairOffset(parts.male, style.id);
      draws.push({
        layer: Layer.hair,
        source: this.textures[hair.texture],
        rect: { x: hair.x, y: hair.y + row, width: 16, height: 32 },
        x: x + sideX,
        y: y + featureY + offsetY,
        options: { flip: direction === 'left' && !hair.uniqueLeft, tint: hairColor },
      });
    }

    if (hat) {
      const source = this.textures[hat.sprite.texture];
      const rect: Rect = { x: hat.sprite.x, y: hat.sprite.y + HAT_ROW[direction], width: 20, height: 20 };
      const hatX = x - 8 + (flip ? -featureX : featureX);
      const hatY = y - 12 + featureY + (hat.skipHairOffset ? 0 : (style?.hatOffset ?? 0)) + heightOffset;
      const tint = hat.prismatic ? prismaticColor(time) : WHITE;
      if (hat.mask && direction === 'up') {
        draws.push({ layer: Layer.hat, source, rect: { ...rect, y: rect.y + 11, height: 9 }, x: hatX, y: hatY + 11 * SCALE });
        draws.push({ layer: Layer.hatMaskUp, source, rect: { ...rect, height: 11 }, x: hatX, y: hatY, options: { tint } });
      } else {
        draws.push({ layer: Layer.hat, source, rect, x: hatX, y: hatY, options: { tint } });
      }
    }

    if (animation.armOffset > 0) {
      draws.push({
        layer: direction === 'up' ? Layer.armsUp : Layer.arms,
        source: this.recolor(texture, { ...sprite, x: sprite.x + animation.armOffset * 16 }, colors),
        rect: FRAME_CELL,
        x,
        y,
        options: { flip },
      });
    }

    const surface = new Surface(FRAME_WIDTH, FRAME_HEIGHT);
    draws.sort((a, b) => a.layer - b.layer);
    for (const { source, rect, x: drawX, y: drawY, options } of draws) surface.draw(source, rect, drawX, drawY, options);
    return surface;
  }

  renderHat(id: string): Surface {
    const hat = this.get(this.hats, id);
    const surface = new Surface(20 * SCALE, 20 * SCALE);
    surface.draw(this.textures[hat.sprite.texture], { x: hat.sprite.x, y: hat.sprite.y, width: 20, height: 20 }, 0, 0, {
      tint: hat.prismatic ? prismaticColor(0) : WHITE,
    });
    return surface;
  }

  private get<K, V>(items: Map<K, V>, id: K): V {
    const item = items.get(id);
    if (!item) throw new Error(`Unknown item ${String(id)}`);
    return item;
  }

  private bodyColors(texture: string, parts: Parts, shirt: Shirt | undefined, sleeveColor: Rgb, boots: Boots | undefined) {
    const { skinTones, shoeColors } = this.catalog;
    const skin = this.paletteRow(skinTones.texture, parts.skin, 3);
    const shoes = boots
      ? this.paletteRow(boots.palette, boots.colorIndex, 4)
      : this.paletteRow(shoeColors.texture, shoeColors.bare, 4);
    const { data } = this.textures[texture];
    const colors = new Map<number, Rgba>();
    const swap = (keys: number[], values: Rgba[]) => keys.forEach((key, i) => colors.set(pack(data, key), values[i]));
    swap(EYE_KEYS, eyeColors(parts.eyeColor));
    swap(SKIN_KEYS, skin);
    swap(SHOE_KEYS, shoes);
    swap(SLEEVE_KEYS, shirt?.sleeves ? this.sleeveColors(shirt, sleeveColor) : skin);
    return colors;
  }

  private recolor(texture: string, rect: Rect, colors: Map<number, Rgba>): Pixels {
    const source = this.textures[texture];
    const data = new Uint8ClampedArray(rect.width * rect.height * 4);
    for (let row = 0; row < rect.height; row++) {
      for (let column = 0; column < rect.width; column++) {
        const pixel = (rect.y + row) * source.width + rect.x + column;
        const color = colors.get(pack(source.data, pixel)) ?? source.data.subarray(pixel * 4, pixel * 4 + 4);
        data.set(color, (row * rect.width + column) * 4);
      }
    }
    return { width: rect.width, height: rect.height, data };
  }

  private paletteRow(texture: string, row: number, count: number): Rgba[] {
    const { data, height } = this.textures[texture];
    const start = (row * count) % (height * count);
    return Array.from({ length: count }, (_, i) => pixelAt(data, start + i));
  }

  private sleeveColors(shirt: Shirt, shirtColor: Rgb): Rgba[] {
    const texture = this.textures[shirt.sprite.texture];
    const { x } = shirt.sprite;
    const y = shirt.sprite.y + 4;
    let multiplier = shirtColor;
    return [0, 1, 2].map((up) => {
      let color = pixelAt(texture.data, (y - up) * texture.width + x + 128);
      if (color[3] < 255) {
        color = pixelAt(texture.data, (y - up) * texture.width + x);
        multiplier = WHITE;
      }
      return multiplyColor(color, multiplier);
    });
  }
}

export function prismaticColor(time: number): Rgb {
  const step = time / 1500;
  const from = PRISMATIC_COLORS[Math.floor(step) % PRISMATIC_COLORS.length];
  const to = PRISMATIC_COLORS[(Math.floor(step) + 1) % PRISMATIC_COLORS.length];
  const t = step % 1;
  return [0, 1, 2].map((c) => Math.trunc((from[c] / 255 + (to[c] / 255 - from[c] / 255) * t) * 255)) as Rgb;
}

function hairOffset(male: boolean, hairstyle: number): number {
  if (male && hairstyle >= 16) return -4;
  if (!male && hairstyle < 16) return 4;
  return 0;
}

function eyeColors([red, green, blue]: Rgb): Rgba[] {
  const light: Rgba = [red, green, blue, 255];
  const dark: Rgba = [Math.max(red - 75, 0), Math.max(green - 75, 0), Math.max(blue - 85, 0), 255];
  if (light.every((channel, i) => channel === dark[i])) light[2] += 10;
  return [light, dark];
}

function pack(data: Uint8ClampedArray, pixel: number): number {
  const i = pixel * 4;
  return (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) >>> 0;
}

function pixelAt(data: Uint8ClampedArray, pixel: number): Rgba {
  return [data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2], data[pixel * 4 + 3]];
}

function multiplyColor(color: Rgba, by: Rgb): Rgba {
  const channel = (a: number, b: number) =>
    Math.trunc(Math.fround(Math.fround(Math.fround(a / 255) * Math.fround(b / 255)) * 255));
  return [channel(color[0], by[0]), channel(color[1], by[1]), channel(color[2], by[2]), channel(color[3], 255)];
}
