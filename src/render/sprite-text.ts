const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 16;
const WIDTH_OFFSETS = new Map([
  [',', -2],
  ['.', -2],
  ['!', -1],
  ['i', -1],
  ['j', -1],
  ['l', -1],
  ['$', 1],
]);

export async function drawSpriteText(canvas: HTMLCanvasElement, text: string, scale: number): Promise<void> {
  const font = new Image();
  font.src = `${import.meta.env.BASE_URL}assets/LooseSprites/font_bold.png`;
  await font.decode();

  const chars = [...text];
  const advances = chars.map(
    (char, i) => GLYPH_WIDTH + (WIDTH_OFFSETS.get(char) ?? 0) + (WIDTH_OFFSETS.get(chars[i + 1]) ?? 0),
  );
  canvas.width = advances.reduce((sum, advance) => sum + advance, 0);
  canvas.height = GLYPH_HEIGHT - 1;
  canvas.style.width = `${canvas.width * scale}px`;

  const context = canvas.getContext('2d')!;
  let x = 0;
  chars.forEach((char, i) => {
    const cell = (char.charCodeAt(0) - 32) * GLYPH_WIDTH;
    const sx = cell % font.naturalWidth;
    const sy = Math.floor(cell / font.naturalWidth) * GLYPH_HEIGHT;
    const y = /\p{Lu}/u.test(char) ? -4 : -1;
    context.drawImage(font, sx, sy, GLYPH_WIDTH, GLYPH_HEIGHT, x, y, GLYPH_WIDTH, GLYPH_HEIGHT);
    x += advances[i];
  });
}
