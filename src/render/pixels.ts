import type { Rgb } from '../catalog/types.ts';

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawOptions {
  tint?: Rgb;
  flip?: boolean;
}

export const SCALE = 4;

export const WHITE: Rgb = [255, 255, 255];

export class Surface {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  draw(source: Pixels, rect: Rect, x: number, y: number, { tint = WHITE, flip = false }: DrawOptions = {}): void {
    for (let row = 0; row < rect.height; row++) {
      const sourceY = rect.y + row;
      if (sourceY < 0 || sourceY >= source.height) continue;
      for (let column = 0; column < rect.width; column++) {
        const sourceX = rect.x + column;
        if (sourceX < 0 || sourceX >= source.width) continue;
        const i = (sourceY * source.width + sourceX) * 4;
        const alpha = source.data[i + 3];
        if (alpha === 0) continue;
        const red = (Math.round((source.data[i] * alpha) / 255) * tint[0]) / 255;
        const green = (Math.round((source.data[i + 1] * alpha) / 255) * tint[1]) / 255;
        const blue = (Math.round((source.data[i + 2] * alpha) / 255) * tint[2]) / 255;
        const targetColumn = flip ? rect.width - 1 - column : column;
        this.fill(x + targetColumn * SCALE, y + row * SCALE, red, green, blue, alpha);
      }
    }
  }

  toStraightAlpha(): Uint8ClampedArray<ArrayBuffer> {
    const out = new Uint8ClampedArray(this.data.length);
    for (let i = 0; i < out.length; i += 4) {
      const alpha = this.data[i + 3];
      if (alpha === 0) continue;
      out[i] = (this.data[i] * 255) / alpha;
      out[i + 1] = (this.data[i + 1] * 255) / alpha;
      out[i + 2] = (this.data[i + 2] * 255) / alpha;
      out[i + 3] = alpha;
    }
    return out;
  }

  private fill(left: number, top: number, red: number, green: number, blue: number, alpha: number): void {
    const keep = 1 - alpha / 255;
    for (let y = Math.max(top, 0); y < Math.min(top + SCALE, this.height); y++) {
      for (let x = Math.max(left, 0); x < Math.min(left + SCALE, this.width); x++) {
        const i = (y * this.width + x) * 4;
        this.data[i] = red + this.data[i] * keep;
        this.data[i + 1] = green + this.data[i + 1] * keep;
        this.data[i + 2] = blue + this.data[i + 2] * keep;
        this.data[i + 3] = alpha + this.data[i + 3] * keep;
      }
    }
  }
}
