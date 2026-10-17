import type { Boots, Catalog, Hairstyle, Hat, Pants, Rgb, Shirt } from '../catalog/types.ts';
import type { Outfit } from '../outfit.ts';
import { FEATURE_X_OFFSET, FEATURE_Y_OFFSET, type AnimationFrame, type Direction } from './animation.ts';
import { SCALE, Surface, WHITE, type DrawOptions, type Pixels, type Rect } from './pixels.ts';

export const FRAME_WIDTH = 80;
export const FRAME_HEIGHT = 144;
const BODY_X = 8;
const BODY_Y = 16;

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
  private readonly keyPixels = new Map<string, Map<number, number[]>>();
  private body: { key: string; pixels: Pixels } | null = null;

  constructor(catalog: Catalog, textures: Record<string, Pixels>) {
    this.catalog = catalog;
    this.textures = textures;
    this.hairstyles = new Map(catalog.hairstyles.map((item) => [item.id, item]));
    this.shirts = new Map(catalog.shirts.map((item) => [item.id, item]));
    this.pants = new Map(catalog.pants.map((item) => [item.id, item]));
    this.hats = new Map(catalog.hats.map((item) => [item.id, item]));
    this.boots = new Map(catalog.boots.map((item) => [item.id, item]));
  }

  isAnimated(outfit: Outfit): boolean {
    const hat = outfit.hat === null ? undefined : this.hats.get(outfit.hat);
    return !!(this.shirts.get(outfit.shirt)?.prismatic || this.pants.get(outfit.pants)?.prismatic || hat?.prismatic);
  }

  render(outfit: Outfit, direction: Direction, animation: AnimationFrame, time: number): Surface {
    const style = this.get(this.hairstyles, outfit.hairstyle);
    const shirt = this.get(this.shirts, outfit.shirt);
    const pants = this.get(this.pants, outfit.pants);
    const hat = outfit.hat === null ? undefined : this.get(this.hats, outfit.hat);
    const boots = outfit.boots === null ? undefined : this.get(this.boots, outfit.boots);
    const accessory = outfit.accessory === null ? undefined : this.catalog.accessories[outfit.accessory];
    const variant = style.variants[hat?.hairMode ?? 'show'];
    const sleeveColor = shirt.prismatic ? prismaticColor(0) : outfit.shirtColor;
    const bodyTexture = this.catalog.bodies[outfit.male ? 'male' : 'female'][variant.bald ? 'bald' : 'base'];
    const body = this.recolorBody(bodyTexture, outfit, shirt, sleeveColor, boots);

    const { frame, flip } = animation;
    const sprite: Rect = { x: (frame * 16) % 96, y: Math.floor((frame * 16) / 96) * 32, width: 16, height: 32 };
    const x = BODY_X + animation.xOffset * SCALE;
    const y = BODY_Y + animation.positionOffset * SCALE;
    const featureX = FEATURE_X_OFFSET[frame] * SCALE;
    const featureY = FEATURE_Y_OFFSET[frame] * SCALE;
    const sideX = direction === 'left' ? -featureX : featureX;
    const heightOffset = outfit.male ? 0 : 4;
    const draws: Draw[] = [];

    draws.push({ layer: Layer.base, source: body, rect: sprite, x, y, options: { flip } });

    draws.push({
      layer: Layer.pants,
      source: this.textures[pants.sprite.texture],
      rect: { ...sprite, x: sprite.x + pants.sprite.x + (outfit.male ? 0 : 96), y: sprite.y + pants.sprite.y },
      x,
      y,
      options: { flip, tint: pants.prismatic ? prismaticColor(time) : outfit.pantsColor },
    });

    const shirtRect: Rect = { x: shirt.sprite.x, y: shirt.sprite.y + SHIRT_ROW[direction], width: 8, height: 8 };
    const shirtX = x + 16 + sideX;
    const shirtY = y + 56 + featureY + heightOffset;
    draws.push({ layer: Layer.shirt, source: this.textures[shirt.sprite.texture], rect: shirtRect, x: shirtX, y: shirtY });
    draws.push({
      layer: Layer.shirtDye,
      source: this.textures[shirt.sprite.texture],
      rect: { ...shirtRect, x: shirtRect.x + 128 },
      x: shirtX,
      y: shirtY,
      options: { tint: shirt.prismatic ? prismaticColor(time) : outfit.shirtColor },
    });

    if (accessory && direction !== 'up') {
      draws.push({
        layer: accessory.belowHair ? Layer.accessoryUnderHair : Layer.accessory,
        source: this.textures[accessory.sprite.texture],
        rect: { x: accessory.sprite.x, y: accessory.sprite.y + (direction === 'down' ? 0 : 16), width: 16, height: 16 },
        x: x + sideX,
        y: y + 4 + featureY + heightOffset,
        options: { flip: direction === 'left', tint: accessory.facialHair ? outfit.hairColor : WHITE },
      });
    }

    if (variant.hairstyle !== null) {
      const hair = this.catalog.hairSprites[variant.hairstyle];
      const row = { down: 0, right: 32, up: 64, left: hair.uniqueLeft ? 96 : 32 }[direction];
      const offsetY =
        direction === 'up'
          ? 4 + hairOffset(outfit.male, variant.hairstyle)
          : hairOffset(outfit.male, outfit.hairstyle);
      draws.push({
        layer: Layer.hair,
        source: this.textures[hair.texture],
        rect: { x: hair.x, y: hair.y + row, width: 16, height: 32 },
        x: x + sideX,
        y: y + featureY + offsetY,
        options: { flip: direction === 'left' && !hair.uniqueLeft, tint: outfit.hairColor },
      });
    }

    if (hat) {
      const source = this.textures[hat.sprite.texture];
      const rect: Rect = { x: hat.sprite.x, y: hat.sprite.y + HAT_ROW[direction], width: 20, height: 20 };
      const hatX = x - 8 + (flip ? -featureX : featureX);
      const hatY = y - 12 + featureY + (hat.skipHairOffset ? 0 : style.hatOffset) + heightOffset;
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
        source: body,
        rect: { ...sprite, x: sprite.x + animation.armOffset * 16 },
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

  private get<K, V>(items: Map<K, V>, id: K): V {
    const item = items.get(id);
    if (!item) throw new Error(`Unknown item ${String(id)}`);
    return item;
  }

  renderBare(male: boolean, skin: number, eyeColor: Rgb, accessory?: { id: number; hairColor: Rgb }): Surface {
    const texture = this.catalog.bodies[male ? 'male' : 'female'].base;
    const body = this.recolorBody(texture, { skin, eyeColor }, undefined, WHITE, undefined);
    const sprite: Rect = { x: 0, y: 0, width: 16, height: 32 };
    const surface = new Surface(sprite.width * SCALE, sprite.height * SCALE);
    surface.draw(body, sprite, 0, 0);
    if (accessory) {
      const { sprite: cell, facialHair } = this.catalog.accessories[accessory.id];
      surface.draw(
        this.textures[cell.texture],
        { x: cell.x, y: cell.y, width: 16, height: 16 },
        0,
        4 + FEATURE_Y_OFFSET[0] * SCALE + (male ? 0 : 4),
        { tint: facialHair ? accessory.hairColor : WHITE },
      );
    }
    surface.draw(body, { ...sprite, x: 96 }, 0, 0);
    return surface;
  }

  private recolorBody(
    texture: string,
    outfit: Pick<Outfit, 'skin' | 'eyeColor'>,
    shirt: Shirt | undefined,
    sleeveColor: Rgb,
    boots: Boots | undefined,
  ): Pixels {
    const { skinTones, shoeColors } = this.catalog;
    const skin = this.paletteRow(skinTones.texture, outfit.skin, 3);
    const shoes = boots
      ? this.paletteRow(boots.palette, boots.colorIndex, 4)
      : this.paletteRow(shoeColors.texture, shoeColors.bare, 4);
    const swaps: [number[], Rgba[]][] = [
      [EYE_KEYS, eyeColors(outfit.eyeColor)],
      [SKIN_KEYS, skin],
      [SHOE_KEYS, shoes],
      [SLEEVE_KEYS, shirt?.sleeves ? this.sleeveColors(shirt, sleeveColor) : skin],
    ];
    const key = texture + JSON.stringify(swaps);
    if (this.body?.key === key) return this.body.pixels;

    const source = this.textures[texture];
    const keyPixels = this.keyPixelsOf(texture);
    const data = new Uint8ClampedArray(source.data);
    for (const [keys, colors] of swaps) {
      keys.forEach((keyIndex, i) => {
        for (const pixel of keyPixels.get(keyIndex) ?? []) data.set(colors[i], pixel * 4);
      });
    }
    const pixels = { width: source.width, height: source.height, data };
    this.body = { key, pixels };
    return pixels;
  }

  private keyPixelsOf(texture: string): Map<number, number[]> {
    let keyPixels = this.keyPixels.get(texture);
    if (!keyPixels) {
      const { data } = this.textures[texture];
      const packed = new Uint32Array(data.buffer, data.byteOffset, data.length / 4);
      keyPixels = new Map();
      for (const keyIndex of [...SLEEVE_KEYS, ...SKIN_KEYS, ...SHOE_KEYS, ...EYE_KEYS]) {
        const matches: number[] = [];
        for (let pixel = 0; pixel < packed.length; pixel++) if (packed[pixel] === packed[keyIndex]) matches.push(pixel);
        keyPixels.set(keyIndex, matches);
      }
      this.keyPixels.set(texture, keyPixels);
    }
    return keyPixels;
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

function pixelAt(data: Uint8ClampedArray, pixel: number): Rgba {
  return [data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2], data[pixel * 4 + 3]];
}

function multiplyColor(color: Rgba, by: Rgb): Rgba {
  const channel = (a: number, b: number) =>
    Math.trunc(Math.fround(Math.fround(Math.fround(a / 255) * Math.fround(b / 255)) * 255));
  return [channel(color[0], by[0]), channel(color[1], by[1]), channel(color[2], by[2]), channel(color[3], 255)];
}
