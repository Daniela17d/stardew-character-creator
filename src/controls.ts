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
    'Body',
    select([['male', 'Male'], ['female', 'Female']], outfit.male ? 'male' : 'female', (value) => {
      outfit.male = value === 'male';
    }),
  );

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

  const directions = document.createElement('div');
  directions.className = 'flex gap-1';
  const buttons = new Map<Direction, HTMLButtonElement>();
  for (const [direction, arrow] of [['left', '←'], ['down', '↓'], ['up', '↑'], ['right', '→']] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = arrow;
    button.ariaLabel = `Face ${direction}`;
    button.className = 'h-8 w-10 rounded border border-black/20 bg-white aria-pressed:bg-black aria-pressed:text-white';
    button.addEventListener('click', () => {
      state.direction = direction;
      for (const [other, otherButton] of buttons) otherButton.ariaPressed = String(other === direction);
    });
    button.ariaPressed = String(direction === state.direction);
    buttons.set(direction, button);
    directions.append(button);
  }

  const walk = document.createElement('label');
  walk.className = 'flex items-center gap-1';
  const walkBox = document.createElement('input');
  walkBox.type = 'checkbox';
  walkBox.checked = state.walking;
  walkBox.addEventListener('change', () => {
    state.walking = walkBox.checked;
  });
  walk.append(walkBox, 'Walk');
  row('Direction', directions, walk);

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
