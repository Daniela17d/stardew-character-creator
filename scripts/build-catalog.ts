import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type {
  Accessory,
  Boots,
  Catalog,
  HairMode,
  HairSprite,
  HairVariant,
  Hairstyle,
  Hat,
  Pants,
  Rgb,
  Shirt,
  Texture,
} from '../src/catalog/types.ts';
import {
  ACCESSORY_COUNT,
  HAT_OFFSET_BY_HAIRSTYLE,
  NEW_FARMER_SHOE_COLOR,
  isBaldHairstyle,
  isBelowHair,
  isFacialHair,
  obscuredHairstyle,
} from './farmer-rules.ts';

interface ClothingData {
  DisplayName: string;
  Description: string;
  Texture: string | null;
  SpriteIndex: number;
  DefaultColor: string | null;
  CanBeDyed: boolean;
  IsPrismatic: boolean;
  CanChooseDuringCharacterCustomization: boolean;
}

interface ShirtData extends ClothingData {
  HasSleeves: boolean;
}

interface HairData {
  sprite: HairSprite;
  coveredIndex: number;
  bald: boolean;
}

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'public', 'assets');

const { values: args } = parseArgs({
  options: {
    content: { type: 'string', default: join(root, 'Content (unpacked)') },
    'game-version': { type: 'string' },
  },
});
const gameVersion = args['game-version'];
check(gameVersion, 'Pass --game-version: the Stardew Valley version the content was unpacked from.');
const contentDir = resolve(args.content);
check(existsSync(join(contentDir, 'Data')), `No unpacked game content in ${contentDir}`);

const textures: Record<string, Texture> = {};
const stringFiles = new Map<string, Record<string, string>>();
const NAMED_COLORS: Record<string, Rgb> = { white: [255, 255, 255] };

// Bodies and palettes

const bodies: Catalog['bodies'] = {
  male: {
    base: useTexture('Characters/Farmer/farmer_base'),
    bald: useTexture('Characters/Farmer/farmer_base_bald'),
  },
  female: {
    base: useTexture('Characters/Farmer/farmer_girl_base'),
    bald: useTexture('Characters/Farmer/farmer_girl_base_bald'),
  },
};

const skinTexture = useTexture('Characters/Farmer/skinColors');
check(textures[skinTexture].width >= 3, `${skinTexture} needs 3 colours per row`);
const shoeTexture = useTexture('Characters/Farmer/shoeColors');
check(NEW_FARMER_SHOE_COLOR < textures[shoeTexture].height, `${shoeTexture} has no bare shoe row`);

// Hairstyles: the sheet holds 8 per 96 px of height, and HairData adds more (ids 100+, plus
// negative ids that are only drawn under hats).

const hairData = new Map<number, HairData>();
for (const [key, raw] of Object.entries(readJson<Record<string, string>>('Data/HairData'))) {
  // texture/tileX/tileY/usesUniqueLeftSprite/coveredIndex/isBaldStyle
  const fields = raw.split('/');
  const what = `HairData ${key}`;
  hairData.set(int(key, what), {
    sprite: {
      texture: useTexture(`Characters/Farmer/${fields[0]}`),
      x: int(fields[1], what) * 16,
      y: int(fields[2], what) * 16,
      uniqueLeft: fields[3]?.toLowerCase() === 'true',
    },
    coveredIndex: fields[4] === undefined ? -1 : int(fields[4], what),
    bald: fields[5]?.toLowerCase() === 'true',
  });
}

const hairTexture = useTexture('Characters/Farmer/hairstyles');
const baseHairCount = Math.floor(textures[hairTexture].height / 96) * 8;
const hairIds = new Set<number>();
for (let id = 0; id < baseHairCount; id++) hairIds.add(id);
for (const id of hairData.keys()) if (id >= 0) hairIds.add(id);

const hairstyles: Hairstyle[] = [...hairIds]
  .sort((a, b) => a - b)
  .map((id) => ({
    id,
    hatOffset: HAT_OFFSET_BY_HAIRSTYLE[id % 16],
    variants: {
      show: hairVariant(id, 'show'),
      obscured: hairVariant(id, 'obscured'),
      hide: hairVariant(id, 'hide'),
    },
  }));

const hairSprites: Record<string, HairSprite> = {};
for (const style of hairstyles) {
  for (const { hairstyle: id } of Object.values(style.variants)) {
    if (id === null || hairSprites[id]) continue;
    const sprite = hairData.get(id)?.sprite ?? baseHairSprite(id);
    checkFits(sprite.texture, sprite.x, sprite.y, 16, sprite.uniqueLeft ? 128 : 96, `hairstyle ${id}`);
    hairSprites[id] = sprite;
  }
}

// Accessories

const accessoryTexture = useTexture('Characters/Farmer/accessories');
const accessories: Accessory[] = [];
for (let id = 0; id < ACCESSORY_COUNT; id++) {
  const { x, y } = cell(id, 16, 32, textures[accessoryTexture].width);
  checkFits(accessoryTexture, x, y, 16, 32, `accessory ${id}`);
  accessories.push({
    id,
    sprite: { texture: accessoryTexture, x, y },
    facialHair: isFacialHair(id),
    belowHair: isBelowHair(id),
  });
}

// Shirts: 16 per row in the left 128 px of the sheet; the dye masks fill the right half.

const shirts: Shirt[] = Object.entries(readJson<Record<string, ShirtData>>('Data/Shirts')).map(
  ([id, data]) => {
    const what = `shirt ${id}`;
    const texture = useTexture(data.Texture ?? 'Characters/Farmer/shirts');
    const { x, y } = cell(data.SpriteIndex, 8, 32, 128);
    checkFits(texture, x, y, 128 + 8, 32, what);
    return {
      id,
      name: text(data.DisplayName, what),
      description: text(data.Description, what),
      sprite: { texture, x, y },
      color: color(data.DefaultColor, what),
      dyeable: data.CanBeDyed,
      prismatic: data.IsPrismatic,
      sleeves: data.HasSleeves,
      creation: data.CanChooseDuringCharacterCustomization,
    };
  },
);

// Pants: 10 per row.

const pants: Pants[] = Object.entries(readJson<Record<string, ClothingData>>('Data/Pants')).map(
  ([id, data]) => {
    const what = `pants ${id}`;
    const texture = useTexture(data.Texture ?? 'Characters/Farmer/pants');
    const { x, y } = cell(data.SpriteIndex, 192, 688, 1920);
    checkFits(texture, x, y, 192, 688, what);
    return {
      id,
      name: text(data.DisplayName, what),
      description: text(data.Description, what),
      sprite: { texture, x, y },
      color: color(data.DefaultColor, what),
      dyeable: data.CanBeDyed,
      prismatic: data.IsPrismatic,
      creation: data.CanChooseDuringCharacterCustomization,
    };
  },
);

// Hats

const hats: Hat[] = Object.entries(readJson<Record<string, string>>('Data/hats')).map(([id, raw]) => {
  // name/description/showRealHair/skipHairstyleOffset/tags/displayName[/spriteIndex[/texture]]
  const fields = raw.split('/');
  const what = `hat ${id}`;
  const texture = useTexture(fields[7] || 'Characters/Farmer/hats');
  const { x, y } = cell(int(fields[6] || id, what), 20, 80, textures[texture].width);
  checkFits(texture, x, y, 20, 80, what);
  const hairMode: HairMode =
    fields[2] === 'hide' ? 'hide' : bool(fields[2], what) ? 'show' : 'obscured';
  return {
    id,
    name: text(fields[5], what),
    description: text(fields[1], what),
    sprite: { texture, x, y },
    hairMode,
    skipHairOffset: bool(fields[3], what),
    mask: fields[0].includes('Mask') && hairMode !== 'hide',
    prismatic: (fields[4] ?? '').split(/\s+/).includes('Prismatic'),
  };
});

// Boots

const boots: Boots[] = Object.entries(readJson<Record<string, string>>('Data/Boots')).map(
  ([id, raw]) => {
    // name/description/price/defense/immunity/colorIndex/displayName[/colorTexture/...]
    const fields = raw.split('/');
    const what = `boots ${id}`;
    const palette = useTexture(fields[7] || 'Characters/Farmer/shoeColors');
    const colorIndex = int(fields[5], what);
    const { width, height } = textures[palette];
    check(width >= 4 && colorIndex >= 0 && colorIndex < height, `${what}: no row ${colorIndex} in ${palette}`);
    return {
      id,
      name: text(fields[6], what),
      description: text(fields[1], what),
      palette,
      colorIndex,
    };
  },
);

for (const [items, what] of [
  [shirts, 'shirt'],
  [pants, 'pants'],
  [hats, 'hat'],
  [boots, 'boots'],
] as const) {
  const ids = new Set(items.map((item) => item.id));
  check(ids.size === items.length, `Duplicate ${what} ids`);
}

const catalog: Catalog = {
  gameVersion,
  textures: Object.fromEntries(Object.entries(textures).sort(([a], [b]) => a.localeCompare(b))),
  bodies,
  skinTones: { texture: skinTexture, count: textures[skinTexture].height },
  shoeColors: { texture: shoeTexture, count: textures[shoeTexture].height, bare: NEW_FARMER_SHOE_COLOR },
  hairstyles,
  hairSprites,
  accessories,
  shirts,
  pants,
  hats,
  boots,
};

// Output: everything was validated above, so only now replace the previous files.

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [key, texture] of Object.entries(catalog.textures)) {
  const target = join(root, 'public', texture.path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(contentDir, `${key}.png`), target);
}
writeFileSync(join(outDir, 'catalog.json'), formatCatalog(catalog));

console.log(
  `Catalogue for Stardew Valley ${gameVersion}: ${hairstyles.length} hairstyles, ` +
    `${accessories.length} accessories, ${catalog.skinTones.count} skin tones, ` +
    `${shirts.length} shirts, ${pants.length} pants, ${hats.length} hats, ${boots.length} boots. ` +
    `Wrote catalog.json and ${Object.keys(textures).length} textures to public/assets/.`,
);

// Helpers

// What the game draws for a hairstyle under a hat with the given hair mode. 
function hairVariant(id: number, mode: HairMode): HairVariant {
  // HairData of the chosen hairstyle decides baldness; without it, the drawn hairstyle does.
  const data = hairData.get(id);
  const bald = (drawn: number | null) => (data ? data.bald : drawn !== null && isBaldHairstyle(drawn));
  switch (mode) {
    case 'show':
      return { hairstyle: id, bald: bald(id) };
    case 'hide':
      return { hairstyle: null, bald: bald(null) };
    case 'obscured': {
      const drawn = obscuredHairstyle(id);
      const covered = hairData.get(drawn)?.coveredIndex ?? -1;
      return { hairstyle: covered === -1 ? drawn : covered, bald: bald(drawn) };
    }
  }
}

function baseHairSprite(id: number): HairSprite {
  check(id >= 0 && id < baseHairCount, `Hairstyle ${id} has no sprite`);
  return { texture: hairTexture, ...cell(id, 16, 96, textures[hairTexture].width), uniqueLeft: false };
}

// Registers a game texture to copy and returns its key, e.g. `Characters/Farmer/hats`. 
function useTexture(assetName: string): string {
  const key = assetName.replaceAll('\\', '/');
  if (!textures[key]) {
    const file = join(contentDir, `${key}.png`);
    check(existsSync(file), `Texture ${key} not found at ${file}`);
    textures[key] = { path: `assets/${key}.png`, ...readPngSize(file) };
  }
  return key;
}

function readPngSize(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(0, 24);
  check(header.toString('latin1', 1, 4) === 'PNG' && header.toString('latin1', 12, 16) === 'IHDR', `${file} is not a PNG`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

// Top-left of sprite `index` in a sheet of `cellWidth` px wide cells wrapping every `rowWidth` px, as the game lays them out. 
function cell(index: number, cellWidth: number, cellHeight: number, rowWidth: number): { x: number; y: number } {
  return {
    x: (index * cellWidth) % rowWidth,
    y: Math.floor((index * cellWidth) / rowWidth) * cellHeight,
  };
}

function checkFits(texture: string, x: number, y: number, width: number, height: number, what: string): void {
  const size = textures[texture];
  check(
    x >= 0 && y >= 0 && x + width <= size.width && y + height <= size.height,
    `${what} lies outside ${texture} (${size.width}×${size.height})`,
  );
}

function readJson<T>(assetName: string): T {
  return JSON.parse(readFileSync(join(contentDir, `${assetName}.json`), 'utf8')) as T;
}

// Resolves the game's `[LocalizedText <asset>:<key>]` tokens to the English text. 
function text(raw: string | undefined, what: string): string {
  check(raw !== undefined, `${what} has no text`);
  const resolved = raw.replace(/\[LocalizedText ([^\]\s:]+):([^\]\s]+)\]/g, (_, asset: string, key: string) => {
    const name = asset.replaceAll('\\', '/');
    let strings = stringFiles.get(name);
    if (!strings) {
      strings = readJson<Record<string, string>>(name);
      stringFiles.set(name, strings);
    }
    const value = strings[key];
    check(value !== undefined, `${what}: no string ${name}:${key}`);
    return value;
  });
  check(!/\[\w+ /.test(resolved), `${what}: unsupported token in "${raw}"`);
  return resolved;
}


// Parses a colour like the game does: "R G B", "R G B A" or a colour name; none means white.
// Alpha is dropped because clothes are always drawn opaque.

function color(raw: string | null, what: string): Rgb {
  const value = raw?.trim();
  if (!value) return [255, 255, 255];
  if (value.includes(' ')) {
    const parts = value.split(/\s+/).map(Number);
    check(
      (parts.length === 3 || parts.length === 4) && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255),
      `${what}: bad colour "${raw}"`,
    );
    return [parts[0], parts[1], parts[2]];
  }
  const named = NAMED_COLORS[value.toLowerCase()];
  check(named, `${what}: unknown colour "${raw}" (add it to NAMED_COLORS)`);
  return named;
}

function int(raw: string | undefined, what: string): number {
  check(raw !== undefined && /^-?\d+$/.test(raw.trim()), `${what}: expected a whole number, got "${raw}"`);
  return Number(raw);
}

// Parses "true" or "false" in any case, like .NET's Convert.ToBoolean. 
function bool(raw: string | undefined, what: string): boolean {
  const value = raw?.trim().toLowerCase();
  check(value === 'true' || value === 'false', `${what}: expected true or false, got "${raw}"`);
  return value === 'true';
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// JSON with one entry per line, which keeps the file compact and its diffs readable. 
function formatCatalog(value: Catalog): string {
  const entries = Object.entries(value).map(([key, section]) => {
    let body: string;
    if (Array.isArray(section)) {
      body = `[\n${section.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
    } else if (typeof section === 'object' && Object.values(section).every((entry) => typeof entry === 'object')) {
      const lines = Object.entries(section).map(([k, entry]) => `    ${JSON.stringify(k)}: ${JSON.stringify(entry)}`);
      body = `{\n${lines.join(',\n')}\n  }`;
    } else {
      body = JSON.stringify(section);
    }
    return `  ${JSON.stringify(key)}: ${body}`;
  });
  return `{\n${entries.join(',\n')}\n}\n`;
}
