import type { Boots, Catalog, Hat, Pants, Rgb, Shirt } from './catalog/types.ts';
import type { Pixels } from './render/pixels.ts';

export type ColorName = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'brown' | 'black' | 'grey' | 'white';

export const COLORS: { name: ColorName; swatch: string }[] = [
  { name: 'red', swatch: '#d32f2f' },
  { name: 'orange', swatch: '#f57c00' },
  { name: 'yellow', swatch: '#fbc02d' },
  { name: 'green', swatch: '#43a047' },
  { name: 'blue', swatch: '#1e88e5' },
  { name: 'purple', swatch: '#8e24aa' },
  { name: 'pink', swatch: '#f06292' },
  { name: 'brown', swatch: '#795548' },
  { name: 'black', swatch: '#212121' },
  { name: 'grey', swatch: '#9e9e9e' },
  { name: 'white', swatch: '#fafafa' },
];

const MIN_SHARE = 0.2;
const MIN_SHARE_DARK = 0.3;
const MIN_SHARE_BROWN = 0.2;
const MIN_SHARE_SECONDARY = 0.3;

type Grid = (Rgb | null)[][];

export function shirtColors(textures: Record<string, Pixels>, shirt: Shirt): Set<ColorName> {
  const texture = textures[shirt.sprite.texture];
  const grid = sample(8, 8, (x, y) => {
    const dye = pixel(texture, shirt.sprite.x + 128 + x, shirt.sprite.y + y);
    if (dye[3] > 0) return multiply(dye, shirt.color);
    const base = pixel(texture, shirt.sprite.x + x, shirt.sprite.y + y);
    return base[3] > 0 ? [base[0], base[1], base[2]] : null;
  });
  return classify(withoutOutline(grid));
}

export function pantsColors(textures: Record<string, Pixels>, pants: Pants): Set<ColorName> {
  const texture = textures[pants.sprite.texture];
  const grid = sample(16, 32, (x, y) => {
    const color = pixel(texture, pants.sprite.x + x, pants.sprite.y + y);
    return color[3] > 0 ? multiply(color, pants.color) : null;
  });
  return classify(withoutOutline(grid));
}

export function hatColors(textures: Record<string, Pixels>, hat: Hat): Set<ColorName> {
  const texture = textures[hat.sprite.texture];
  const grid = sample(20, 20, (x, y) => {
    const color = pixel(texture, hat.sprite.x + x, hat.sprite.y + y);
    return color[3] > 0 ? [color[0], color[1], color[2]] : null;
  });
  return classify(withoutOutline(grid));
}

export function bootsColors(textures: Record<string, Pixels>, catalog: Catalog, boots: Boots): Set<ColorName> {
  const texture = textures[boots.palette] ?? textures[catalog.shoeColors.texture];
  const colors: Rgb[] = [1, 2, 3].map((i) => {
    const color = pixel(texture, i, boots.colorIndex);
    return [color[0], color[1], color[2]];
  });
  return classify(colors, 0.3);
}

export function colorName([red, green, blue]: Rgb): ColorName {
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  const saturation = max ? (max - min) / max : 0;
  if (max < 0.22) return 'black';
  if (saturation < 0.18) return max < 0.3 ? 'black' : max > 0.8 ? 'white' : 'grey';
  if (saturation < 0.25 && max > 0.7) return 'white';
  const hue = hueOf(red, green, blue);
  if ((hue < 45 || hue >= 330) && saturation < 0.35 && max < 0.7) return 'brown';
  if (hue < 15 || hue >= 345) return max < 0.3 ? 'black' : saturation < 0.45 && max > 0.75 ? 'pink' : 'red';
  if (hue < 40) return max < 0.6 || saturation < 0.4 ? 'brown' : 'orange';
  if (hue < 68) return max < 0.5 ? 'brown' : 'yellow';
  if (hue < 165) return 'green';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'purple';
  return 'pink';
}

function sample(width: number, height: number, at: (x: number, y: number) => Rgb | null): Grid {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => at(x, y)));
}

function withoutOutline(grid: Grid): Rgb[] {
  const colors: Rgb[] = [];
  grid.forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      const edge = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => !grid[ny]?.[nx]);
      if (edge && Math.max(...color) < 0.35 * 255) return;
      colors.push(color);
    }),
  );
  return colors;
}

function classify(colors: Rgb[], minShare = MIN_SHARE): Set<ColorName> {
  const counts = new Map<ColorName, number>();
  for (const color of colors) {
    const name = colorName(color);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const result = new Set<ColorName>();
  [...counts]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count], rank) => {
      const share = count / colors.length;
      const needed = name === 'grey' ? MIN_SHARE_DARK : name === 'brown' ? MIN_SHARE_BROWN : 0;
      if (share >= Math.max(minShare, needed, rank === 0 ? 0 : MIN_SHARE_SECONDARY)) result.add(name);
    });
  return result;
}

function hueOf(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (!delta) return 0;
  const hue =
    max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function pixel(texture: Pixels, x: number, y: number): [number, number, number, number] {
  const i = (y * texture.width + x) * 4;
  return [texture.data[i], texture.data[i + 1], texture.data[i + 2], texture.data[i + 3]];
}

function multiply(color: ArrayLike<number>, by: Rgb): Rgb {
  return [(color[0] * by[0]) / 255, (color[1] * by[1]) / 255, (color[2] * by[2]) / 255];
}
