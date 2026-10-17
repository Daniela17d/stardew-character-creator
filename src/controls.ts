import type { Catalog, Rgb } from './catalog/types.ts';
import type { Outfit } from './outfit.ts';
import type { Direction } from './render/animation.ts';

export interface ViewState {
  outfit: Outfit;
  direction: Direction;
  walking: boolean;
}

type Options = [value: string, label: string][];

const FIELD = 'w-56 rounded border border-black/20 bg-white px-2 py-1';
const LABEL = 'font-semibold';
const BUTTON = 'rounded border border-black/20 bg-white hover:bg-white/70 aria-pressed:bg-black aria-pressed:text-white';

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

  preview.append(frame, genders);
  return preview;
}

export function createControls(catalog: Catalog, state: ViewState): HTMLElement {
  const { outfit } = state;
  const form = document.createElement('form');
  form.className = 'grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-2 text-sm';
  form.addEventListener('submit', (event) => event.preventDefault());

  const row = (label: string, field: HTMLElement, extra?: HTMLElement) => {
    const text = document.createElement('label');
    text.className = LABEL;
    text.textContent = label;
    form.append(text, field, extra ?? document.createElement('span'));
  };

  row(
    'Skin',
    select(range(catalog.skinTones.count, 0), String(outfit.skin), (value) => {
      outfit.skin = Number(value);
    }),
  );

  row(
    'Eyes',
    colorInput(outfit.eyeColor, (value) => {
      outfit.eyeColor = value;
    }),
  );

  const hairstyles: Options = catalog.hairstyles.map((style, i) => [String(style.id), String(i + 1)]);
  row(
    'Hairstyle',
    select(hairstyles, String(outfit.hairstyle), (value) => {
      outfit.hairstyle = Number(value);
    }),
    colorInput(outfit.hairColor, (value) => {
      outfit.hairColor = value;
    }),
  );

  row(
    'Accessory',
    select([['', 'None'], ...range(catalog.accessories.length, 0)], String(outfit.accessory ?? ''), (value) => {
      outfit.accessory = value === '' ? null : Number(value);
    }),
  );

  const shirtColor = colorInput(outfit.shirtColor, (value) => {
    outfit.shirtColor = value;
  });
  const syncShirt = () => {
    const shirt = catalog.shirts.find((item) => item.id === outfit.shirt);
    shirtColor.disabled = !shirt?.dyeable;
    shirtColor.value = toHex(outfit.shirtColor);
  };
  row(
    'Shirt',
    select(itemOptions(catalog.shirts), outfit.shirt, (value) => {
      outfit.shirt = value;
      outfit.shirtColor = catalog.shirts.find((item) => item.id === value)?.color ?? outfit.shirtColor;
      syncShirt();
    }),
    shirtColor,
  );
  syncShirt();

  const pantsColor = colorInput(outfit.pantsColor, (value) => {
    outfit.pantsColor = value;
  });
  const syncPants = () => {
    const pants = catalog.pants.find((item) => item.id === outfit.pants);
    pantsColor.disabled = !pants?.dyeable;
    pantsColor.value = toHex(outfit.pantsColor);
  };
  row(
    'Pants',
    select(itemOptions(catalog.pants), outfit.pants, (value) => {
      outfit.pants = value;
      outfit.pantsColor = catalog.pants.find((item) => item.id === value)?.color ?? outfit.pantsColor;
      syncPants();
    }),
    pantsColor,
  );
  syncPants();

  row(
    'Hat',
    select([['', 'None'], ...itemOptions(catalog.hats)], outfit.hat ?? '', (value) => {
      outfit.hat = value === '' ? null : value;
    }),
  );

  row(
    'Boots',
    select([['', 'None'], ...itemOptions(catalog.boots)], outfit.boots ?? '', (value) => {
      outfit.boots = value === '' ? null : value;
    }),
  );

  const walk = document.createElement('input');
  walk.type = 'checkbox';
  walk.className = 'h-4 w-4';
  walk.checked = state.walking;
  walk.addEventListener('change', () => {
    state.walking = walk.checked;
  });
  row('Walk', walk);

  return form;
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

function range(count: number, first: number): Options {
  return Array.from({ length: count }, (_, i) => [String(first + i), String(i + 1)]);
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
