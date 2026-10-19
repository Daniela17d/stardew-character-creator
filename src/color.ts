import type { Rgb } from './catalog/types.ts';

export function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function fromHex(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}
