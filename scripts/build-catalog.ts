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
  Ingredient,
  Pants,
  Rgb,
  Shirt,
  Source,
  Tailoring,
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
  Price: number;
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

interface ObjectData {
  Name: string;
  DisplayName: string;
  Category: number;
  ContextTags: string[] | null;
  Texture: string | null;
  SpriteIndex: number;
  GeodeDrops: (ChanceItemData & { SetFlagOnPickup: string | null })[] | null;
}

interface TailoringRecipeData {
  Id: string;
  FirstItemTags: string[];
  SecondItemTags: string[];
  CraftedItemId: string | null;
  CraftedItemIds: string[] | null;
  CraftedItemIdFeminine: string | null;
}

interface SpawnItemData {
  ItemId: string | null;
  Condition: string | null;
}

interface ChanceItemData extends SpawnItemData {
  Chance: number;
}

interface ShopData {
  Currency: number;
  Items: (SpawnItemData & { Price: number; TradeItemId: string | null; TradeItemAmount: number })[] | null;
}

interface MakeoverOutfitData {
  Gender: string | null;
  OutfitParts: { ItemId: string; Gender: string | null }[] | null;
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
const icons: Record<string, Texture> = {};
const stringFiles = new Map<string, Record<string, string>>();
const NAMED_COLORS: Record<string, Rgb> = { white: [255, 255, 255] };
const CATEGORY_TAGS: Record<number, string> = { [-4]: 'category_fish', [-75]: 'category_vegetable', [-79]: 'category_fruits' };
const WORN_AS: Record<string, string> = { '(O)71': '(P)15' };
const SHOP_NAMES: Record<string, string> = {
  AdventureShop: "Adventurer's Guild",
  Casino: 'Casino',
  DesertFestival_Abigail: "Desert Festival, Abigail's stall",
  DesertFestival_EggShop: 'Desert Festival egg shop',
  DesertFestival_Elliott: "Desert Festival, Elliott's stall",
  DesertFestival_Maru: "Desert Festival, Maru's stall",
  DesertTrade: 'Desert Trader',
  Festival_NightMarket_MagicBoat_Day1: 'Night Market magic boat, day 1',
  Festival_NightMarket_MagicBoat_Day2: 'Night Market magic boat, day 2',
  Festival_NightMarket_MagicBoat_Day3: 'Night Market magic boat, day 3',
  Festival_StardewValleyFair_StarTokens: 'Stardew Valley Fair',
  HatMouse: 'Hat Mouse',
  IslandTrade: 'Island Trader',
  QiGemShop: "Qi's Walnut Room",
  Raccoon: "Raccoon family's shop",
  Sandy: 'Oasis',
  Traveler: 'Traveling Cart',
  VolcanoShop: 'Volcano Dwarf',
};
const CURRENCIES: Record<number, string> = { 0: 'g', 1: ' star tokens', 2: ' Qi coins', 4: ' Qi gems' };
const MAIL_FLAGS: Record<string, string> = {
  'Egg Festival': 'after winning the egg hunt at the Egg Festival',
  'Ice Festival': 'after winning the fishing contest at the Festival of Ice',
};
const STATS: Record<string, string> = {
  ticketPrizesClaimed: 'after claiming {0} prizes from the prize machine',
  trashCansChecked: 'after checking {0} garbage cans',
};
const WORLD_STATE_FIELDS: Record<string, string> = { TimesFedRaccoons: 'after helping the raccoon family {0} times' };
const TREE_NAMES: Record<string, string> = { 7: 'a mushroom tree' };
const LOCATION_NAMES: Record<string, string> = { IslandFarmCave: 'the Ginger Island farm cave' };


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



const hairData = new Map<number, HairData>();
for (const [key, raw] of Object.entries(readJson<Record<string, string>>('Data/HairData'))) {
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


const objectData = readJson<Record<string, ObjectData>>('Data/Objects');
const tailoring = tailoringRecipes();
const sources = obtainSources();

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
      tailoring: tailoring.byItem.get(`(S)${id}`) ?? [],
      sources: sources.get(`(S)${id}`) ?? [],
    };
  },
);


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
      tailoring: tailoring.byItem.get(`(P)${id}`) ?? [],
      sources: sources.get(`(P)${id}`) ?? [],
    };
  },
);


const hats: Hat[] = Object.entries(readJson<Record<string, string>>('Data/hats')).map(([id, raw]) => {
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
    tailoring: tailoring.byItem.get(`(H)${id}`) ?? [],
    sources: sources.get(`(H)${id}`) ?? [],
  };
});


const boots: Boots[] = Object.entries(readJson<Record<string, string>>('Data/Boots')).map(
  ([id, raw]) => {
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
      sources: sources.get(`(B)${id}`) ?? [],
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
  icons: Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b))),
  bodies,
  skinTones: { texture: skinTexture, count: textures[skinTexture].height },
  shoeColors: { texture: shoeTexture, count: textures[shoeTexture].height, bare: NEW_FARMER_SHOE_COLOR },
  hairstyles,
  hairSprites,
  accessories,
  cloth: tailoring.cloth,
  shirts,
  pants,
  hats,
  boots,
};

const villagerSprites = (JSON.parse(readFileSync(join(root, 'src', 'npc-presets.json'), 'utf8')) as { sprite: string }[]).map(
  ({ sprite }) => `Characters/${sprite}`,
);
for (const sprite of villagerSprites) check(existsSync(join(contentDir, `${sprite}.png`)), `No villager sprite ${sprite}`);
const titleFont = 'LooseSprites/font_bold';
check(existsSync(join(contentDir, `${titleFont}.png`)), `No title font ${titleFont}`);


rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [key, texture] of Object.entries({ ...catalog.textures, ...catalog.icons })) {
  const target = join(root, 'public', texture.path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(contentDir, `${key}.png`), target);
}
for (const sprite of villagerSprites) copyFileSync(join(contentDir, `${sprite}.png`), join(outDir, `${sprite}.png`));
mkdirSync(join(outDir, dirname(titleFont)), { recursive: true });
copyFileSync(join(contentDir, `${titleFont}.png`), join(outDir, `${titleFont}.png`));
writeFileSync(join(outDir, 'catalog.json'), formatCatalog(catalog));

console.log(
  `Catalogue for Stardew Valley ${gameVersion}: ${hairstyles.length} hairstyles, ` +
    `${accessories.length} accessories, ${catalog.skinTones.count} skin tones, ` +
    `${shirts.length} shirts, ${pants.length} pants, ${hats.length} hats, ${boots.length} boots. ` +
    `Wrote catalog.json, ${Object.keys(textures).length} textures, ${Object.keys(icons).length} icon sheets, ` +
    `${villagerSprites.length} villager sprites and the title font to public/assets/.`,
);


function tailoringRecipes(): { cloth: Ingredient; byItem: Map<string, Tailoring[]> } {
  const objects = Object.entries(objectData).map(([id, data]) => ({
    id,
    data,
    tags: new Set([
      `id_o_${contextTag(id)}`,
      `item_${contextTag(data.Name)}`,
      ...(data.ContextTags ?? []),
      ...(CATEGORY_TAGS[data.Category] ? [CATEGORY_TAGS[data.Category]] : []),
    ]),
  }));
  type GameObject = (typeof objects)[number];
  const cloth = objects.find((object) => object.tags.has('item_cloth'));
  check(cloth, 'Data/Objects has no Cloth');
  const fits = (object: GameObject, tags: string[]) => tags.every((tag) => object.tags.has(tag));
  const recipes = readJson<TailoringRecipeData[]>('Data/TailoringRecipes');
  const bases = new Map(
    recipes.map((recipe) => {
      const matches = objects.filter((object) => fits(object, recipe.FirstItemTags));
      check(matches.length === 1, `Tailoring ${recipe.Id}: expected one item with ${recipe.FirstItemTags}`);
      check(objects.some((object) => fits(object, recipe.SecondItemTags)), `Tailoring ${recipe.Id}: no item has ${recipe.SecondItemTags}`);
      return [recipe, matches[0]];
    }),
  );

  const used = new Map<TailoringRecipeData, GameObject[]>();
  for (const base of new Set(bases.values())) {
    const options = recipes.filter((recipe) => bases.get(recipe) === base);
    for (const object of objects) {
      const recipe = options.find((entry) => fits(object, entry.SecondItemTags));
      if (recipe) used.set(recipe, [...(used.get(recipe) ?? []), object]);
    }
  }
  const names = new Map(
    [...bases.values(), ...[...used.values()].flat()].map((object) => [object, text(object.data.DisplayName, `object ${object.id}`)]),
  );
  const ingredient = (object: GameObject): Ingredient => {
    let name = names.get(object)!;
    if ([...names.values()].filter((other) => other === name).length > 1) {
      const color = [...object.tags].find((tag) => tag.startsWith('color_'));
      name += ` (${color ? color.slice(6).replaceAll('_', ' ') : object.id})`;
    }
    return objectIngredient(object.id, name);
  };

  const byItem = new Map<string, Tailoring[]>();
  for (const recipe of recipes) {
    const matched = used.get(recipe);
    if (!matched) continue;
    const base = bases.get(recipe) === cloth ? undefined : ingredient(bases.get(recipe)!);
    const male = recipe.CraftedItemIds?.length ? recipe.CraftedItemIds : [recipe.CraftedItemId];
    const female = recipe.CraftedItemIdFeminine ? [recipe.CraftedItemIdFeminine] : male;
    for (const id of new Set([...male, ...female])) {
      check(id && /^\(\w+\)/.test(id), `Tailoring ${recipe.Id}: expected a qualified item id, got "${id}"`);
      const farmer = !female.includes(id) ? 'male' : !male.includes(id) ? 'female' : undefined;
      const random = (farmer === 'female' ? female : male).length > 1;
      const target = WORN_AS[id] ?? id;
      const entries = byItem.get(target) ?? [];
      const items = matched.map(ingredient);
      const same = entries.find(
        (entry) => entry.base?.name === base?.name && entry.farmer === farmer && Boolean(entry.random) === random,
      );
      if (same) same.items.push(...items.filter((item) => !same.items.some((other) => other.name === item.name)));
      else entries.push({ ...(base ? { base } : {}), items, ...(farmer ? { farmer } : {}), ...(random ? { random } : {}) });
      byItem.set(target, entries);
    }
  }
  return { cloth: ingredient(cloth), byItem };
}

function obtainSources(): Map<string, Source[]> {
  const clothing = new Set(
    Object.entries({ '(S)': 'Data/Shirts', '(P)': 'Data/Pants', '(H)': 'Data/hats', '(B)': 'Data/Boots' }).flatMap(([type, asset]) =>
      Object.keys(readJson<Record<string, unknown>>(asset)).map((id) => type + id),
    ),
  );
  const sources = new Map<string, Source[]>();
  const add = (itemId: string | null, source: () => Source) => {
    const id = itemId?.startsWith('(') ? itemId : itemId && !objectData[itemId] ? [...clothing].find((entry) => entry.endsWith(`)${itemId}`)) : undefined;
    if (!id || !clothing.has(id)) return;
    const entries = sources.get(id) ?? [];
    const next = source();
    if (!entries.some((entry) => JSON.stringify(entry) === JSON.stringify(next))) entries.push(next);
    sources.set(id, entries);
  };
  const sourceOf = (where: string, when: string[]): Source => (when.length ? { where, when } : { where });
  const odds = (chance: number) => (chance < 1 ? [`${percent(chance)} chance`] : []);

  const achievements = readJson<Record<string, string>>('Data/Achievements');
  const describe = (query: string | null, what: string): string[] =>
    (query ? query.split(',') : []).map((part) => {
      const [type, ...args] = (part.match(/"[^"]*"|\S+/g) ?? []).map((arg) => arg.replaceAll('"', ''));
      const fill = (template: string | undefined, value = '') => {
        check(template, `${what}: no wording for the condition "${part.trim()}"`);
        return template.replace('{0}', value);
      };
      switch (type) {
        case 'PLAYER_HAS_ACHIEVEMENT': {
          const [name, description] = achievements[args[1]]?.split('^') ?? [];
          check(description, `${what}: no achievement ${args[1]}`);
          return `after the achievement “${name}” (${description.replace(/\.$/, '')})`;
        }
        case 'PLAYER_HAS_ALL_ACHIEVEMENTS':
          return 'after earning every achievement';
        case 'PLAYER_HAS_MAIL':
          return fill(MAIL_FLAGS[args[1]]);
        case 'PLAYER_STAT':
          return fill(STATS[args[1]], args[2]);
        case 'WORLD_STATE_FIELD':
          return fill(WORLD_STATE_FIELDS[args[0]], args[1]);
        case 'MINE_LOWEST_LEVEL_REACHED':
          return `after reaching mine level ${args[0]}`;
        case 'DAY_OF_MONTH':
          return fill(args.length === 1 && (args[0] === 'odd' || args[0] === 'even') ? `on ${args[0]} days` : undefined);
        case 'DAY_OF_WEEK':
          return `on ${args.map((day) => `${day}s`).join(' and ')}`;
        case 'SYNCED_RANDOM':
          return `${percent(Number(args[2]))} chance each ${args[0]}`;
        case 'RANDOM':
          return `${percent(Number(args[0]))} chance`;
      }
      return fill(undefined);
    });

  const shirtData = readJson<Record<string, ShirtData>>('Data/Shirts');
  for (const [key, shop] of Object.entries(readJson<Record<string, ShopData>>('Data/Shops'))) {
    for (const entry of shop.Items ?? []) {
      const range = /^RANDOM_ITEMS \(S\) (\d+) (\d+) @requirePrice @isRandomSale$/.exec(entry.ItemId ?? '');
      const ids = range
        ? Object.keys(shirtData)
            .filter((id) => +id >= +range[1] && +id <= +range[2] && shirtData[id].Price > 0)
            .map((id) => `(S)${id}`)
        : [entry.ItemId];
      for (const id of ids) {
        add(id, () => {
          const what = `Shop ${key}, ${entry.ItemId}`;
          check(SHOP_NAMES[key], `${what}: add the shop to SHOP_NAMES`);
          const source = sourceOf(SHOP_NAMES[key], [...(range ? ['random daily stock'] : []), ...describe(entry.Condition, what)]);
          if (entry.TradeItemId) {
            const tradeId = entry.TradeItemId.replace(/^\(O\)/, '');
            check(objectData[tradeId], `${what}: can't show the trade item ${entry.TradeItemId}`);
            source.trade = { item: objectIngredient(tradeId), amount: entry.TradeItemAmount };
          }
          if (!entry.TradeItemId || entry.Price > 0) {
            check(entry.Price >= 0 && CURRENCIES[shop.Currency], `${what}: no price`);
            source.cost = `${entry.Price.toLocaleString('en-US')}${CURRENCIES[shop.Currency]}`;
          }
          return source;
        });
      }
    }
  }

  for (const [key, quest] of Object.entries(
    readJson<Record<string, { DisplayName: string; Count: number; RewardItemId: string | null }>>('Data/MonsterSlayerQuests'),
  )) {
    add(quest.RewardItemId, () =>
      sourceOf("Adventurer's Guild", [`reward for slaying ${quest.Count} ${text(quest.DisplayName, `slayer quest ${key}`)}`]),
    );
  }

  const garbage = readJson<{ BeforeAll: SpawnItemData[]; AfterAll: SpawnItemData[]; GarbageCans: Record<string, { Items: SpawnItemData[] | null }> }>(
    'Data/GarbageCans',
  );
  for (const drop of [...garbage.BeforeAll, ...garbage.AfterAll, ...Object.values(garbage.GarbageCans).flatMap((can) => can.Items ?? [])]) {
    add(drop.ItemId, () => sourceOf('Garbage cans', describe(drop.Condition, `garbage ${drop.ItemId}`)));
  }

  for (const [id, tree] of Object.entries(readJson<Record<string, { ChopItems: ChanceItemData[] | null }>>('Data/WildTrees'))) {
    for (const drop of tree.ChopItems ?? []) {
      add(drop.ItemId, () => {
        check(TREE_NAMES[id], `Wild tree ${id} drops clothing: add it to TREE_NAMES`);
        return sourceOf(`Chopping ${TREE_NAMES[id]}`, [...odds(drop.Chance), ...describe(drop.Condition, `tree ${id}`)]);
      });
    }
  }

  for (const [id, data] of Object.entries(objectData)) {
    for (const drop of data.GeodeDrops ?? []) {
      add(drop.ItemId, () => {
        const once = drop.SetFlagOnPickup && drop.Condition === `!PLAYER_HAS_MAIL Current ${drop.SetFlagOnPickup}`;
        return sourceOf(`Opening a ${text(data.DisplayName, `object ${id}`)}`, [
          ...odds(drop.Chance),
          ...(once ? ['once'] : describe(drop.Condition, `object ${id}`)),
        ]);
      });
    }
  }

  for (const [id, location] of Object.entries(readJson<Record<string, { Fish: ChanceItemData[] | null }>>('Data/Locations'))) {
    for (const fish of location.Fish ?? []) {
      add(fish.ItemId, () => {
        check(LOCATION_NAMES[id], `${id} has clothing to fish up: add it to LOCATION_NAMES`);
        return sourceOf(`Fishing in ${LOCATION_NAMES[id]}`, [...odds(fish.Chance), ...describe(fish.Condition, `fish in ${id}`)]);
      });
    }
  }

  const makeovers = new Map<string, Set<string | null>>();
  for (const outfit of readJson<MakeoverOutfitData[]>('Data/MakeoverOutfits')) {
    for (const part of outfit.OutfitParts ?? []) {
      makeovers.set(part.ItemId, (makeovers.get(part.ItemId) ?? new Set()).add(part.Gender ?? outfit.Gender));
    }
  }
  for (const [itemId, genders] of makeovers) {
    const only = genders.size === 1 ? [...genders][0] : null;
    add(itemId, () => sourceOf('Desert Festival makeover', ['part of a random outfit', ...(only ? [`${only.toLowerCase()} farmers only`] : [])]));
  }
  return sources;
}

function objectIngredient(id: string, name?: string): Ingredient {
  const data = objectData[id];
  const texture = useTexture(data.Texture ?? 'Maps/springobjects', icons);
  const { x, y } = cell(data.SpriteIndex, 16, 16, icons[texture].width);
  checkFits(texture, x, y, 16, 16, `object ${id}`);
  return { name: name ?? text(data.DisplayName, `object ${id}`), icon: { texture, x, y } };
}

function percent(chance: number): string {
  return `${+(chance * 100).toFixed(3)}%`;
}

function contextTag(value: string): string {
  return value.trim().toLowerCase().replaceAll(' ', '_').replaceAll("'", '');
}

function hairVariant(id: number, mode: HairMode): HairVariant {
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

function useTexture(assetName: string, into = textures): string {
  const key = assetName.replaceAll('\\', '/');
  if (!into[key]) {
    const file = join(contentDir, `${key}.png`);
    check(existsSync(file), `Texture ${key} not found at ${file}`);
    into[key] = { path: `assets/${key}.png`, ...readPngSize(file) };
  }
  return key;
}

function readPngSize(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(0, 24);
  check(header.toString('latin1', 1, 4) === 'PNG' && header.toString('latin1', 12, 16) === 'IHDR', `${file} is not a PNG`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function cell(index: number, cellWidth: number, cellHeight: number, rowWidth: number): { x: number; y: number } {
  return {
    x: (index * cellWidth) % rowWidth,
    y: Math.floor((index * cellWidth) / rowWidth) * cellHeight,
  };
}

function checkFits(texture: string, x: number, y: number, width: number, height: number, what: string): void {
  const size = textures[texture] ?? icons[texture];
  check(
    x >= 0 && y >= 0 && x + width <= size.width && y + height <= size.height,
    `${what} lies outside ${texture} (${size.width}×${size.height})`,
  );
}

function readJson<T>(assetName: string): T {
  return JSON.parse(readFileSync(join(contentDir, `${assetName}.json`), 'utf8')) as T;
}

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

function bool(raw: string | undefined, what: string): boolean {
  const value = raw?.trim().toLowerCase();
  check(value === 'true' || value === 'false', `${what}: expected true or false, got "${raw}"`);
  return value === 'true';
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
