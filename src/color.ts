import type { Rgb } from './catalog/types.ts';

export type Bars = [hue: number, saturation: number, value: number];

export const BAR_MAX = 99;

export function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function fromHex(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

export function hsvToRgb(hue: number, saturation: number, value: number): Rgb {
  let rgb = [value, value, value];
  if (value <= 0) rgb = [0, 0, 0];
  else if (saturation > 0) {
    const sector = Math.floor(hue / 60);
    const f = hue / 60 - sector;
    const p = value * (1 - saturation);
    const q = value * (1 - saturation * f);
    const t = value * (1 - saturation * (1 - f));
    rgb = [[value, t, p], [q, value, p], [p, value, t], [p, q, value], [t, p, value], [value, p, q]][sector] ?? rgb;
  }
  return rgb.map((channel) => Math.min(255, Math.max(0, Math.trunc(channel * 255)))) as Rgb;
}

export function barsToRgb([hue, saturation, value]: Bars): Rgb {
  return hsvToRgb((hue / 100) * 360, saturation / 100, value / 100);
}

export function rgbToBars([r, g, b]: Rgb): Bars {
  const f = Math.fround;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = r === max ? f((g - b) / delta) : g === max ? f(2 + f((b - r) / delta)) : f(4 + f((r - g) / delta));
  hue = f(hue * 60);
  if (hue < 0) hue = f(hue + 360);
  const saturation = max === 0 ? 0 : f(delta / max);
  return [
    Number.isNaN(hue) ? 0 : Math.trunc(f(f(hue / 360) * 100)),
    Math.min(BAR_MAX, Math.trunc(f(saturation * 100))),
    Math.min(BAR_MAX, Math.trunc(f(f(max / 255) * 100))),
  ];
}
