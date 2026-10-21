import { ACCESSORY_NAMES } from './accessory-names.ts';
import type { Catalog, Ingredient, Pants, Shirt, Source, Tailoring } from './catalog/types.ts';
import { BAR_MAX, barsToRgb, hsvToRgb, rgbToBars, toHex, type Bars } from './color.ts';
import { createFilter } from './filters.ts';
import { bootsColors, correctColors, hatColors, pantsColors, shirtColors } from './item-colors.ts';
import SOURCE_NOTES from './item-sources.json';
import type { Outfit } from './outfit.ts';
import type { Direction } from './render/animation.ts';
import { BODY_X, BODY_Y, type FarmerRenderer, type Parts } from './render/farmer.ts';
import { SCALE, type Pixels, type Rect, type Surface } from './render/pixels.ts';
import { VILLAGERS, villagerOutfit } from './villagers.ts';

export interface ViewState {
  outfit: Outfit;
  direction: Direction;
  walking: boolean;
}

interface Choice<T> {
  value: T;
  label?: string;
  caption?: string;
  details?: () => HTMLElement;
  picture: HTMLElement;
}

const LABEL = 'font-semibold';
export const BUTTON = 'rounded border border-black/20 bg-white hover:bg-white/70 aria-pressed:bg-black aria-pressed:text-white';
const TAB =
  'rounded border border-black/20 bg-white px-4 py-1 font-semibold hover:bg-white/70 aria-selected:border-[#8B4513] aria-selected:bg-[#8B4513] aria-selected:text-white';
const OPTION =
  'flex flex-col items-center rounded border-2 border-transparent bg-white/50 p-1 text-xs font-semibold hover:bg-white aria-pressed:border-[#8B4513] aria-pressed:bg-white';

const FULL_BODY = bodyArea(0, 0, 16, 32);
const BUST = bodyArea(0, 0, 16, 20);
const HEAD = bodyArea(0, 0, 16, 24);
export const TORSO = bodyArea(2, 13, 12, 12);
export const LEGS = bodyArea(0, 16, 16, 16);
export const FEET = bodyArea(0, 24, 16, 8);
export const WHOLE_HAT: Rect = { x: 0, y: 0, width: 20 * SCALE, height: 20 * SCALE };
const ICON_SCALE = 2;

const FACING: Direction[] = ['up', 'right', 'down', 'left'];
const OUTFIT_CHANGED = 'outfitchange';
export const BAR_NAMES = ['Hue', 'Saturation', 'Value'];

export function createPreview(canvas: HTMLCanvasElement, state: ViewState): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'flex flex-col items-center gap-3';

  const frame = document.createElement('div');
  frame.className = 'relative rounded-lg border-4 border-[#8B4513] px-4 pt-4 pb-12';
  const rotate = (label: string, arrow: string, position: string, turn: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = arrow;
    button.ariaLabel = label;
    button.className = `absolute bottom-2 ${position} h-8 w-8 ${BUTTON}`;
    button.addEventListener('click', () => {
      state.direction = FACING[(FACING.indexOf(state.direction) + turn) % FACING.length];
    });
    return button;
  };
  frame.append(canvas, rotate('Rotate left', '◀', 'left-2', 1), rotate('Rotate right', '▶', 'right-2', 3));

  const genders = document.createElement('div');
  genders.className = 'flex gap-2';
  const genderButtons = (['Male', 'Female'] as const).map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = `px-4 py-1 ${BUTTON}`;
    button.addEventListener('click', () => {
      state.outfit.male = label === 'Male';
      syncGender();
    });
    return button;
  });
  const syncGender = () => {
    genderButtons.forEach((button, i) => (button.ariaPressed = String(state.outfit.male === (i === 0))));
  };
  syncGender();
  document.addEventListener(OUTFIT_CHANGED, syncGender);
  genders.append(...genderButtons);

  const walk = document.createElement('label');
  walk.className = 'flex items-center gap-2 text-sm font-semibold';
  const walkBox = document.createElement('input');
  walkBox.type = 'checkbox';
  walkBox.className = 'h-4 w-4';
  walkBox.checked = state.walking;
  walkBox.addEventListener('change', () => {
    state.walking = walkBox.checked;
  });
  walk.append(walkBox, 'Walk');

  preview.append(frame, genders, walk);
  return preview;
}

export function createEditor(
  catalog: Catalog,
  state: ViewState,
  renderer: FarmerRenderer,
  textures: Record<string, Pixels>,
): { tabs: HTMLElement; panel: HTMLElement; refresh: () => void } {
  const { outfit } = state;
  const tabs = document.createElement('nav');
  tabs.role = 'tablist';
  tabs.className = 'flex items-center gap-3 border-b-2 border-[#8B4513] pb-4';
  const mainTabs = document.createElement('div');
  mainTabs.className = 'flex flex-1 flex-wrap justify-center gap-2';
  const divider = document.createElement('span');
  divider.ariaHidden = 'true';
  divider.className = 'h-7 w-0.5 bg-[#8B4513]';
  const sideTabs = document.createElement('div');
  sideTabs.className = 'flex gap-2';
  tabs.append(mainTabs, divider, sideTabs);
  const panel = document.createElement('div');
  panel.className = 'min-w-80';
  const sections: { tab: HTMLButtonElement; section: HTMLElement; paint: () => void }[] = [];
  let active = 0;

  const show = (index: number) => {
    active = index;
    sections.forEach(({ tab, section }, i) => {
      tab.ariaSelected = String(i === index);
      section.hidden = i !== index;
    });
  };

  const section = (name: string, aside = false) => {
    const index = sections.length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.role = 'tab';
    tab.textContent = name;
    tab.className = TAB;
    tab.addEventListener('click', () => show(index));
    const grid = document.createElement('div');
    grid.role = 'tabpanel';
    grid.className = 'grid grid-cols-[6rem_auto] items-start gap-x-3 gap-y-3 text-sm';
    (aside ? sideTabs : mainTabs).append(tab);
    panel.append(grid);
    const entry = { tab, section: grid, paint: () => {} };
    sections.push(entry);
    return {
      row: (label: string, field: HTMLElement) => {
        const text = document.createElement('label');
        text.className = `${LABEL} pt-1`;
        text.textContent = label;
        grid.append(text, field);
      },
      paintWith: (paint: () => void) => {
        entry.paint = paint;
      },
    };
  };

  const bare = (): Parts => ({ male: outfit.male, skin: outfit.skin, eyeColor: barsToRgb(outfit.eyeColor) });
  const shirtNames = distinctNames(catalog.shirts);
  const pantsNames = distinctNames(catalog.pants);
  const hatNames = distinctNames(catalog.hats);
  const bootsNames = distinctNames(catalog.boots);
  const shirtNotes = notesFor('shirts', shirtNames);
  const pantsNotes = notesFor('pants', pantsNames);
  const hatNotes = notesFor('hats', hatNames);
  const bootsNotes = notesFor('boots', bootsNames);

  const body = section('Body');
  const skinPictures = Array.from({ length: catalog.skinTones.count }, () => thumbnail('h-16 w-8'));
  body.row(
    'Skin',
    choiceGrid(
      skinPictures.map((picture, skin) => ({ value: skin, label: String(skin + 1), picture })),
      'grid-cols-8',
      () => outfit.skin,
      (skin) => (outfit.skin = skin),
    ),
  );
  body.row(
    'Eyes',
    colorBars(
      () => outfit.eyeColor,
      (value) => {
        outfit.eyeColor = value;
      },
      'In game: new game or the Shrine of Illusions.',
    ).field,
  );
  const accessoryPictures = catalog.accessories.map(() => thumbnail('h-10 w-8'));
  body.row(
    'Accessory',
    choiceGrid<number | null>(
      [
        { value: null, label: '1', caption: '1 · None', picture: noneIcon('h-10 w-8') },
        ...catalog.accessories.map(({ id }, i) => ({
          value: id,
          label: String(id + 2),
          caption: `${id + 2} · ${ACCESSORY_NAMES[id] ?? 'Accessory'}`,
          picture: accessoryPictures[i],
        })),
      ],
      'grid-cols-8',
      () => outfit.accessory,
      (id) => (outfit.accessory = id),
      'Names are unofficial: the game only gives accessories a number.',
    ),
  );
  const paintSkins = whenChanged(
    () => [outfit.male, outfit.eyeColor],
    () => skinPictures.forEach((picture, skin) => paint(picture, renderer.render({ ...bare(), skin }), FULL_BODY)),
  );
  const paintAccessories = whenChanged(
    () => [outfit.male, outfit.skin, outfit.eyeColor, outfit.hairColor],
    () =>
      catalog.accessories.forEach(({ id }, i) =>
        paint(accessoryPictures[i], renderer.render({ ...bare(), accessory: id, hairColor: barsToRgb(outfit.hairColor) }), BUST),
      ),
  );
  body.paintWith(() => {
    paintSkins();
    paintAccessories();
  });

  const hair = section('Hair');
  const hairPictures = catalog.hairstyles.map(() => thumbnail('h-12 w-8'));
  hair.row(
    'Style',
    choiceGrid(
      catalog.hairstyles.map((style, i) => ({ value: style.id, label: String(i + 1), picture: hairPictures[i] })),
      'grid-cols-8',
      () => outfit.hairstyle,
      (id) => (outfit.hairstyle = id),
    ),
  );
  hair.row(
    'Colour',
    colorBars(
      () => outfit.hairColor,
      (value) => {
        outfit.hairColor = value;
      },
      'In game: new game or the Shrine of Illusions.',
    ).field,
  );
  hair.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin, outfit.eyeColor, outfit.hairColor],
      () =>
        catalog.hairstyles.forEach((style, i) =>
          paint(
            hairPictures[i],
            renderer.render({ ...bare(), hairstyle: style.id, hairColor: barsToRgb(outfit.hairColor) }),
            HEAD,
          ),
        ),
    ),
  );

  const shirt = section('Shirt');
  const shirtColor = colorBars(
    () => outfit.shirtColor,
    (value) => {
      outfit.shirtColor = value;
    },
    "In game: Emily's dye pots.",
  );
  const syncShirtColor = () => {
    shirtColor.field.disabled = !catalog.shirts.find((item) => item.id === outfit.shirt)?.dyeable;
    shirtColor.sync();
  };
  document.addEventListener(OUTFIT_CHANGED, syncShirtColor);
  const shirtPictures = catalog.shirts.map(() => thumbnail('h-12 w-12'));
  shirt.row(
    'Style',
    choiceGrid(
      catalog.shirts.map((item, i) => {
        const number = shirtNumber(item);
        return {
          value: item.id,
          label: number,
          caption: newGameCaption(shirtNames.get(item.id) ?? item.name, number),
          details: () => itemDetails(catalog, item, shirtNotes(item.id)),
          picture: shirtPictures[i],
        };
      }),
      'grid-cols-6',
      () => outfit.shirt,
      (id) => {
        outfit.shirt = id;
        const color = catalog.shirts.find((item) => item.id === id)?.color;
        if (color) outfit.shirtColor = rgbToBars(color);
        syncShirtColor();
      },
      undefined,
      createFilter(
        correctColors(
          'shirts',
          catalog.shirts.map((item) => ({
            id: item.id,
            name: shirtNames.get(item.id) ?? item.name,
            colors: shirtColors(textures, item),
            anyColor: item.dyeable || item.prismatic,
            dyeable: item.dyeable,
            creation: item.creation,
            tailorable: item.tailoring.length > 0,
            buyable: sold(item.sources),
          })),
        ),
        { dyeable: true, creation: true, obtain: true },
      ),
    ),
  );
  shirt.row('Colour', shirtColor.field);
  syncShirtColor();
  shirt.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin],
      () => catalog.shirts.forEach((item, i) => paint(shirtPictures[i], renderer.render({ ...bare(), shirt: item.id }), TORSO)),
    ),
  );

  const pants = section('Pants');
  const pantsColor = colorBars(
    () => outfit.pantsColor,
    (value) => {
      outfit.pantsColor = value;
    },
    "In game: new game or Emily's dye pots.",
  );
  const syncPantsColor = () => {
    pantsColor.field.disabled = !catalog.pants.find((item) => item.id === outfit.pants)?.dyeable;
  };
  document.addEventListener(OUTFIT_CHANGED, syncPantsColor);
  const pantsPictures = catalog.pants.map(() => thumbnail('h-12 w-12'));
  pants.row(
    'Style',
    choiceGrid(
      catalog.pants.map((item, i) => {
        const number = pantsNumber(item);
        return {
          value: item.id,
          label: number,
          caption: newGameCaption(pantsNames.get(item.id) ?? item.name, number),
          details: () => itemDetails(catalog, item, pantsNotes(item.id)),
          picture: pantsPictures[i],
        };
      }),
      'grid-cols-6',
      () => outfit.pants,
      (id) => {
        outfit.pants = id;
        syncPantsColor();
      },
      undefined,
      createFilter(
        correctColors(
          'pants',
          catalog.pants.map((item) => ({
            id: item.id,
            name: pantsNames.get(item.id) ?? item.name,
            colors: pantsColors(textures, item),
            anyColor: item.dyeable || item.prismatic,
            dyeable: item.dyeable,
            creation: item.creation,
            tailorable: item.tailoring.length > 0,
            buyable: sold(item.sources),
          })),
        ),
        { dyeable: true, creation: true, obtain: true },
      ),
    ),
  );
  pants.row('Colour', pantsColor.field);
  syncPantsColor();
  pants.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin],
      () => catalog.pants.forEach((item, i) => paint(pantsPictures[i], renderer.render({ ...bare(), pants: item.id }), LEGS)),
    ),
  );

  const hat = section('Hat');
  const hatPictures = catalog.hats.map(() => thumbnail('h-10 w-10'));
  hat.row(
    'Style',
    choiceGrid<string | null>(
      [
        { value: null, caption: 'None', picture: noneIcon('h-10 w-10') },
        ...catalog.hats.map((item, i) => ({
          value: item.id,
          caption: hatNames.get(item.id),
          details: () => itemDetails(catalog, item, hatNotes(item.id)),
          picture: hatPictures[i],
        })),
      ],
      'grid-cols-7',
      () => outfit.hat,
      (id) => (outfit.hat = id),
      undefined,
      createFilter(
        correctColors(
          'hats',
          catalog.hats.map((item) => ({
            id: item.id,
            name: hatNames.get(item.id) ?? item.name,
            colors: hatColors(textures, item),
            anyColor: item.prismatic,
            tailorable: item.tailoring.length > 0,
            buyable: sold(item.sources),
          })),
        ),
        { obtain: true },
      ),
    ),
  );
  hat.paintWith(
    whenChanged(
      () => [],
      () => catalog.hats.forEach((item, i) => paint(hatPictures[i], renderer.renderHat(item.id), WHOLE_HAT)),
    ),
  );

  const boots = section('Boots');
  const bootsPictures = catalog.boots.map(() => thumbnail('h-6 w-12'));
  boots.row(
    'Style',
    choiceGrid<string | null>(
      [
        { value: null, caption: 'None', picture: noneIcon('h-6 w-12') },
        ...catalog.boots.map((item, i) => ({
          value: item.id,
          caption: bootsNames.get(item.id),
          details: () => itemDetails(catalog, item, bootsNotes(item.id)),
          picture: bootsPictures[i],
        })),
      ],
      'grid-cols-6',
      () => outfit.boots,
      (id) => (outfit.boots = id),
      undefined,
      createFilter(
        correctColors(
          'boots',
          catalog.boots.map((item) => ({
            id: item.id,
            name: bootsNames.get(item.id) ?? item.name,
            colors: bootsColors(textures, catalog, item),
            anyColor: false,
            buyable: sold(item.sources),
          })),
        ),
        { obtain: true },
      ),
    ),
  );
  boots.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin],
      () => catalog.boots.forEach((item, i) => paint(bootsPictures[i], renderer.render({ ...bare(), boots: item.id }), FEET)),
    ),
  );

  const villagers = section('Villagers', true);
  const villagerPictures = VILLAGERS.map(() => thumbnail('h-16 w-8'));
  let villager: string | null = null;
  villagers.row(
    'Villager',
    choiceGrid<string | null>(
      VILLAGERS.map((preset, i) => ({ value: preset.name, label: preset.name, picture: villagerPictures[i] })),
      'grid-cols-6',
      () => villager,
      (name) => {
        villager = name;
        const preset = VILLAGERS.find((entry) => entry.name === name);
        if (preset) Object.assign(outfit, villagerOutfit(catalog, preset, outfit));
        document.dispatchEvent(new Event(OUTFIT_CHANGED));
      },
      'Looks based on my own interpretation of each character.',
    ),
  );
  villagers.paintWith(
    whenChanged(
      () => [],
      () =>
        VILLAGERS.forEach((preset, i) =>
          drawSprite(villagerPictures[i], `${import.meta.env.BASE_URL}assets/Characters/${preset.sprite}.png`),
        ),
    ),
  );

  show(0);
  return { tabs, panel, refresh: () => sections[active].paint() };
}

function choiceGrid<T>(
  choices: Choice<T>[],
  columns: string,
  selected: () => T,
  pick: (value: T) => void,
  note?: string,
  filter?: { bar: HTMLElement; matches: (value: T) => boolean; onChange: (listener: () => void) => void },
): HTMLElement {
  const field = document.createElement('div');
  field.className = 'flex flex-col gap-2';
  const grid = document.createElement('div');
  grid.className = `grid ${columns} gap-2 ${choices.length > 40 ? 'max-h-96 overflow-y-auto p-1' : ''}`;
  const labelled = choices.some((choice) => choice.label);
  const captioned = choices.some((choice) => choice.caption);
  const caption = document.createElement('p');
  caption.className = 'font-semibold';
  const details = document.createElement('div');
  details.className = 'w-0 min-w-full';
  const describe = (value: T) => {
    const choice = choices.find((entry) => entry.value === value);
    caption.textContent = choice?.caption ?? '';
    details.replaceChildren(...(choice?.details ? [choice.details()] : []));
  };

  const buttons = choices.map((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = OPTION;
    button.ariaLabel = choice.caption ?? choice.label ?? '';
    if (choice.caption) button.title = choice.caption;
    button.append(choice.picture);
    if (labelled) {
      const text = document.createElement('span');
      text.textContent = choice.label || ' ';
      button.append(text);
    }
    button.addEventListener('click', () => {
      pick(choice.value);
      sync();
    });
    if (captioned) {
      for (const event of ['mouseenter', 'focus']) button.addEventListener(event, () => describe(choice.value));
      for (const event of ['mouseleave', 'blur']) button.addEventListener(event, () => describe(selected()));
    }
    grid.append(button);
    return button;
  });

  const sync = () => {
    buttons.forEach((button, i) => (button.ariaPressed = String(choices[i].value === selected())));
    if (captioned) describe(selected());
  };
  sync();
  document.addEventListener(OUTFIT_CHANGED, sync);

  if (filter) {
    const count = document.createElement('p');
    count.className = 'text-xs text-black/60';
    const apply = () => {
      let shown = 0;
      let total = 0;
      buttons.forEach((button, i) => {
        const value = choices[i].value;
        const visible = filter.matches(value);
        button.hidden = !visible;
        if (value !== null) {
          total++;
          if (visible) shown++;
        }
      });
      count.textContent = shown === total ? `${total} items` : shown ? `${shown} of ${total}` : 'Nothing matches these filters.';
    };
    filter.onChange(apply);
    apply();
    field.append(filter.bar, count);
  }

  field.append(grid);
  if (captioned) field.append(caption);
  if (choices.some((choice) => choice.details)) field.append(details);
  if (note) {
    const text = document.createElement('p');
    text.className = 'text-xs italic text-black/60';
    text.textContent = note;
    field.append(text);
  }
  return field;
}

export function shirtNumber(item: Shirt): string {
  return item.creation ? String((item.sprite.y / 32) * 16 + item.sprite.x / 8 + 1) : '';
}

export function pantsNumber(item: Pants): string {
  return item.creation ? String((item.sprite.y / 688) * 10 + item.sprite.x / 192 + 1) : '';
}

function newGameCaption(name: string, number: string): string {
  return number ? `${name} · new game #${number}` : name;
}

function sold(sources: Source[]): boolean {
  return sources.some((source) => source.cost || source.trade);
}

function notesFor(kind: keyof typeof SOURCE_NOTES, names: Map<string, string>): (id: string) => string[] {
  const listed: Record<string, string[]> = SOURCE_NOTES[kind];
  const known = new Set(names.values());
  for (const name of Object.keys(listed)) if (!known.has(name)) console.warn(`item-sources.json: no ${kind} called "${name}"`);
  return (id) => listed[names.get(id) ?? ''] ?? [];
}

function itemDetails(catalog: Catalog, item: { tailoring?: Tailoring[]; sources: Source[] }, notes: string[]): HTMLElement {
  const element = document.createElement('div');
  element.className = 'flex flex-col gap-1';
  element.append(
    ...(item.tailoring ?? []).map((recipe) => tailoringLine(catalog, recipe)),
    ...item.sources.map((source) => sourceLine(catalog, source)),
    ...notes.map(noteLine),
  );
  if (!element.childElementCount) element.textContent = 'No known source.';
  return element;
}

function tailoringLine(catalog: Catalog, { base, items, farmer, random }: Tailoring): HTMLElement {
  const line = document.createElement('p');
  line.className = 'flex flex-wrap items-center gap-x-2 gap-y-1';
  line.append(bold('Sewing machine:'), ingredient(catalog, base ?? catalog.cloth), '+');
  if (items.length > 2) line.append('one of:');
  items.forEach((item, i) => {
    if (i && items.length === 2) line.append('or');
    line.append(ingredient(catalog, item));
  });
  if (farmer) line.append(`(${farmer} farmer)`);
  if (random) line.append('(random result)');
  return line;
}

function sourceLine(catalog: Catalog, { where, cost, trade, when }: Source): HTMLElement {
  const parts: (string | Node)[][] = [];
  if (cost) parts.push([cost]);
  if (trade) parts.push([`${trade.amount} × `, ingredient(catalog, trade.item)]);
  for (const condition of when ?? []) parts.push([condition]);
  const line = document.createElement('p');
  line.append(bold(`${where}:`), ' ');
  parts.forEach((part, i) => line.append(...(i ? [', '] : []), ...part));
  return line;
}

function noteLine(note: string): HTMLElement {
  const line = document.createElement('p');
  const split = note.indexOf(': ');
  line.append(...(split > 0 ? [bold(note.slice(0, split + 1)), note.slice(split + 1)] : [note]));
  return line;
}

function bold(text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = 'font-semibold';
  element.textContent = text;
  return element;
}

function ingredient(catalog: Catalog, { name, icon }: Ingredient): HTMLElement {
  const sheet = catalog.icons[icon.texture];
  const picture = document.createElement('span');
  picture.ariaHidden = 'true';
  picture.className = 'shrink-0 [image-rendering:pixelated]';
  picture.style.width = picture.style.height = `${16 * ICON_SCALE}px`;
  picture.style.backgroundImage = `url(${import.meta.env.BASE_URL}${sheet.path})`;
  picture.style.backgroundPosition = `-${icon.x * ICON_SCALE}px -${icon.y * ICON_SCALE}px`;
  picture.style.backgroundSize = `${sheet.width * ICON_SCALE}px ${sheet.height * ICON_SCALE}px`;
  const chip = document.createElement('span');
  chip.className = 'inline-flex items-center gap-1 align-middle';
  chip.append(picture, name);
  return chip;
}

export function distinctNames(items: { id: string; name: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const { name } of items) counts.set(name, (counts.get(name) ?? 0) + 1);
  return new Map(items.map(({ id, name }) => [id, (counts.get(name) ?? 0) > 1 ? `${name} (${id})` : name]));
}

function bodyArea(left: number, top: number, width: number, height: number): Rect {
  return { x: BODY_X + left * SCALE, y: BODY_Y + top * SCALE, width: width * SCALE, height: height * SCALE };
}

export function thumbnail(size: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = `${size} [image-rendering:pixelated]`;
  return canvas;
}

function noneIcon(size: string): HTMLElement {
  const icon = document.createElement('span');
  icon.className = `${size} text-gray-500`;
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" class="h-full w-full" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/></svg>';
  return icon;
}

export function paint(canvas: HTMLCanvasElement, surface: Surface, area: Rect): void {
  canvas.width = area.width;
  canvas.height = area.height;
  canvas.getContext('2d')!.putImageData(new ImageData(surface.toStraightAlpha(), surface.width, surface.height), -area.x, -area.y);
}

export function whenChanged(key: () => unknown[], draw: () => void): () => void {
  let drawnFor: string | null = null;
  return () => {
    const next = JSON.stringify(key());
    if (next === drawnFor) return;
    drawnFor = next;
    draw();
  };
}

function drawSprite(canvas: HTMLCanvasElement, url: string): void {
  const image = new Image();
  image.addEventListener('load', () => {
    canvas.width = 16;
    canvas.height = 32;
    canvas.getContext('2d')!.drawImage(image, 0, 0, 16, 32, 0, 0, 16, 32);
  });
  image.src = url;
}

function colorBars(
  get: () => Bars,
  set: (value: Bars) => void,
  note: string,
): { field: HTMLFieldSetElement; sync: () => void } {
  const field = document.createElement('fieldset');
  field.className = 'flex flex-col gap-1 pt-1 disabled:opacity-30';
  const sliders = BAR_NAMES.map((name, i) => {
    const input = document.createElement('input');
    input.type = 'range';
    input.max = String(BAR_MAX);
    input.ariaLabel = name;
    input.className = 'color-bar w-40';
    const number = document.createElement('span');
    number.className = 'w-7 text-right font-semibold tabular-nums';
    input.addEventListener('input', () => {
      const bars: Bars = [...get()];
      bars[i] = Number(input.value);
      set(bars);
      sync();
    });
    const letter = document.createElement('span');
    letter.ariaHidden = 'true';
    letter.title = name;
    letter.className = 'w-3 text-xs font-semibold text-black/60';
    letter.textContent = name[0];
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.append(letter, input, number);
    field.append(row);
    return { input, number };
  });
  const sync = () => {
    const bars = get();
    sliders.forEach(({ input, number }, i) => {
      input.style.background = barGradient(bars, i);
      input.value = String(bars[i]);
      number.textContent = String(bars[i]);
    });
  };
  const hint = document.createElement('p');
  hint.className = 'text-xs italic text-black/60';
  hint.textContent = note;
  field.append(hint);
  sync();
  document.addEventListener(OUTFIT_CHANGED, sync);
  return { field, sync };
}

export function barGradient([hue, saturation, value]: Bars, index: number): string {
  const degrees = (hue / 100) * 360;
  const color = [
    (step: number) => hsvToRgb(step * 360, 0.9, 0.9),
    (step: number) => hsvToRgb(degrees, step, value / 100),
    (step: number) => hsvToRgb(degrees, saturation / 100, step),
  ][index];
  return `linear-gradient(to right, ${Array.from({ length: 24 }, (_, i) => toHex(color(i / 24))).join(', ')})`;
}
