import { ACCESSORY_NAMES } from './accessory-names.ts';
import type { Catalog, Rgb } from './catalog/types.ts';
import type { Outfit } from './outfit.ts';
import type { Direction } from './render/animation.ts';
import type { FarmerRenderer } from './render/farmer.ts';
import { SCALE, type Surface } from './render/pixels.ts';

export interface ViewState {
  outfit: Outfit;
  direction: Direction;
  walking: boolean;
}

type Options = [value: string, label: string][];

const FIELD = 'w-56 rounded border border-black/20 bg-white px-2 py-1';
const LABEL = 'font-semibold';
const BUTTON = 'rounded border border-black/20 bg-white hover:bg-white/70 aria-pressed:bg-black aria-pressed:text-white';
const TAB =
  'rounded border border-black/20 bg-white px-4 py-1 font-semibold hover:bg-white/70 aria-selected:border-[#8B4513] aria-selected:bg-[#8B4513] aria-selected:text-white';
const OPTION =
  'flex flex-col items-center rounded border-2 border-transparent bg-white/50 p-1 text-xs font-semibold hover:bg-white aria-pressed:border-[#8B4513] aria-pressed:bg-white';
const NONE_ICON =
  '<svg viewBox="0 0 32 40" class="h-10 w-8 text-gray-500" fill="none" stroke="currentColor" stroke-width="3"><circle cx="16" cy="20" r="11"/><path d="M8.5 12.5l15 15"/></svg>';
const BUST_ROWS = 20;

const FACING: Direction[] = ['up', 'right', 'down', 'left'];

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
): { tabs: HTMLElement; panel: HTMLElement; refresh: () => void } {
  const { outfit } = state;
  const tabs = document.createElement('nav');
  tabs.role = 'tablist';
  tabs.className = 'flex flex-wrap justify-center gap-2 border-b-2 border-[#8B4513] pb-4';
  const panel = document.createElement('div');
  panel.className = 'min-w-80';
  const sections: { tab: HTMLButtonElement; section: HTMLElement }[] = [];

  const show = (index: number) => {
    sections.forEach(({ tab, section }, i) => {
      tab.ariaSelected = String(i === index);
      section.hidden = i !== index;
    });
  };

  const section = (name: string) => {
    const index = sections.length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.role = 'tab';
    tab.textContent = name;
    tab.className = TAB;
    tab.addEventListener('click', () => show(index));
    const grid = document.createElement('div');
    grid.role = 'tabpanel';
    grid.className = 'grid grid-cols-[6rem_auto] items-center gap-x-3 gap-y-2 text-sm';
    tabs.append(tab);
    panel.append(grid);
    sections.push({ tab, section: grid });
    return (label: string, field: HTMLElement) => {
      const text = document.createElement('label');
      text.className = LABEL;
      text.textContent = label;
      grid.append(text, field);
    };
  };

  const body = section('Body');
  const skins = document.createElement('div');
  skins.className = 'grid grid-cols-8 gap-2';
  const skinOptions = Array.from({ length: catalog.skinTones.count }, (_, skin) => {
    const thumbnail = document.createElement('canvas');
    thumbnail.className = 'h-16 w-8 [image-rendering:pixelated]';
    const button = optionButton(`Skin ${skin + 1}`, String(skin + 1), thumbnail, () => {
      outfit.skin = skin;
      syncSkins();
    });
    skins.append(button);
    return { button, thumbnail };
  });
  const syncSkins = () => {
    skinOptions.forEach(({ button }, skin) => (button.ariaPressed = String(skin === outfit.skin)));
  };
  syncSkins();
  body('Skin', skins);
  body(
    'Eyes',
    colorInput(outfit.eyeColor, (value) => {
      outfit.eyeColor = value;
    }),
  );

  const accessories = document.createElement('div');
  accessories.className = 'grid grid-cols-8 gap-2';
  const none = document.createElement('span');
  none.innerHTML = NONE_ICON;
  const caption = document.createElement('p');
  caption.className = 'font-semibold';
  const accessoryNumber = (id: number | null) => String(id === null ? 1 : id + 2);
  const accessoryName = (id: number | null) => (id === null ? 'None' : (ACCESSORY_NAMES[id] ?? `Accessory ${id + 2}`));
  const describe = (id: number | null) => {
    caption.textContent = `${accessoryNumber(id)} · ${accessoryName(id)}`;
  };
  const accessoryOption = (id: number | null, picture: HTMLElement) => {
    const button = optionButton(`${accessoryNumber(id)}: ${accessoryName(id)}`, accessoryNumber(id), picture, () => pickAccessory(id));
    button.title = accessoryName(id);
    for (const show of ['mouseenter', 'focus']) button.addEventListener(show, () => describe(id));
    for (const hide of ['mouseleave', 'blur']) button.addEventListener(hide, () => describe(outfit.accessory));
    return button;
  };
  const accessoryOptions = [
    { id: null, thumbnail: null, button: accessoryOption(null, none) },
    ...catalog.accessories.map(({ id }) => {
      const thumbnail = document.createElement('canvas');
      thumbnail.className = 'h-10 w-8 [image-rendering:pixelated]';
      return { id, thumbnail, button: accessoryOption(id, thumbnail) };
    }),
  ];
  const pickAccessory = (id: number | null) => {
    outfit.accessory = id;
    accessoryOptions.forEach((option) => (option.button.ariaPressed = String(option.id === outfit.accessory)));
    describe(id);
  };
  pickAccessory(outfit.accessory);
  accessories.append(...accessoryOptions.map(({ button }) => button));
  const accessoryField = document.createElement('div');
  accessoryField.className = 'flex flex-col gap-2';
  accessoryField.append(accessories, caption);
  body('Accessory', accessoryField);

  let skinsDrawnFor = '';
  let accessoriesDrawnFor = '';
  const refresh = () => {
    const skinKey = JSON.stringify([outfit.male, outfit.eyeColor]);
    if (skinKey !== skinsDrawnFor) {
      skinsDrawnFor = skinKey;
      skinOptions.forEach(({ thumbnail }, skin) => paint(thumbnail, renderer.renderBare(outfit.male, skin, outfit.eyeColor)));
    }
    const accessoryKey = JSON.stringify([outfit.male, outfit.skin, outfit.eyeColor, outfit.hairColor]);
    if (accessoryKey !== accessoriesDrawnFor) {
      accessoriesDrawnFor = accessoryKey;
      for (const { id, thumbnail } of accessoryOptions) {
        if (id === null || !thumbnail) continue;
        const surface = renderer.renderBare(outfit.male, outfit.skin, outfit.eyeColor, { id, hairColor: outfit.hairColor });
        paint(thumbnail, surface, BUST_ROWS * SCALE);
      }
    }
  };

  const hair = section('Hair');
  const hairstyles: Options = catalog.hairstyles.map((style, i) => [String(style.id), String(i + 1)]);
  hair(
    'Style',
    select(hairstyles, String(outfit.hairstyle), (value) => {
      outfit.hairstyle = Number(value);
    }),
  );
  hair(
    'Colour',
    colorInput(outfit.hairColor, (value) => {
      outfit.hairColor = value;
    }),
  );

  const shirt = section('Shirt');
  const shirtColor = colorInput(outfit.shirtColor, (value) => {
    outfit.shirtColor = value;
  });
  const syncShirt = () => {
    shirtColor.disabled = !catalog.shirts.find((item) => item.id === outfit.shirt)?.dyeable;
    shirtColor.value = toHex(outfit.shirtColor);
  };
  shirt(
    'Style',
    select(itemOptions(catalog.shirts), outfit.shirt, (value) => {
      outfit.shirt = value;
      outfit.shirtColor = catalog.shirts.find((item) => item.id === value)?.color ?? outfit.shirtColor;
      syncShirt();
    }),
  );
  shirt('Colour', shirtColor);
  syncShirt();

  const pants = section('Pants');
  const pantsColor = colorInput(outfit.pantsColor, (value) => {
    outfit.pantsColor = value;
  });
  const syncPants = () => {
    pantsColor.disabled = !catalog.pants.find((item) => item.id === outfit.pants)?.dyeable;
    pantsColor.value = toHex(outfit.pantsColor);
  };
  pants(
    'Style',
    select(itemOptions(catalog.pants), outfit.pants, (value) => {
      outfit.pants = value;
      outfit.pantsColor = catalog.pants.find((item) => item.id === value)?.color ?? outfit.pantsColor;
      syncPants();
    }),
  );
  pants('Colour', pantsColor);
  syncPants();

  section('Hat')(
    'Style',
    select([['', 'None'], ...itemOptions(catalog.hats)], outfit.hat ?? '', (value) => {
      outfit.hat = value === '' ? null : value;
    }),
  );

  section('Boots')(
    'Style',
    select([['', 'None'], ...itemOptions(catalog.boots)], outfit.boots ?? '', (value) => {
      outfit.boots = value === '' ? null : value;
    }),
  );

  show(0);
  return { tabs, panel, refresh };
}

function optionButton(label: string, number: string, picture: HTMLElement, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.ariaLabel = label;
  button.className = OPTION;
  const text = document.createElement('span');
  text.textContent = number;
  button.append(picture, text);
  button.addEventListener('click', onClick);
  return button;
}

function paint(canvas: HTMLCanvasElement, surface: Surface, height = surface.height): void {
  canvas.width = surface.width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(surface.toStraightAlpha(), surface.width, surface.height), 0, 0);
}

function select(options: Options, value: string, onChange: (value: string) => void): HTMLSelectElement {
  const element = document.createElement('select');
  element.className = FIELD;
  for (const [optionValue, label] of options) element.add(new Option(label, optionValue, false, optionValue === value));
  element.addEventListener('change', () => onChange(element.value));
  return element;
}

function colorInput(value: Rgb, onChange: (value: Rgb) => void): HTMLInputElement {
  const element = document.createElement('input');
  element.type = 'color';
  element.value = toHex(value);
  element.className = 'h-8 w-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30';
  element.addEventListener('input', () => onChange(fromHex(element.value)));
  return element;
}

function itemOptions(items: { id: string; name: string }[]): Options {
  const counts = new Map<string, number>();
  for (const { name } of items) counts.set(name, (counts.get(name) ?? 0) + 1);
  return items.map(({ id, name }) => [id, (counts.get(name) ?? 0) > 1 ? `${name} (${id})` : name]);
}

function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function fromHex(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}
