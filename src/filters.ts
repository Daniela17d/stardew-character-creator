import { COLORS, type ColorName } from './item-colors.ts';

export interface FilterItem {
  id: string;
  name: string;
  colors: Set<ColorName>;
  anyColor: boolean;
  dyeable?: boolean;
  creation?: boolean;
}

export interface Filter {
  bar: HTMLElement;
  matches: (id: string | null) => boolean;
  onChange: (listener: () => void) => void;
}

export function createFilter(items: FilterItem[], options: { dyeable?: boolean; creation?: boolean } = {}): Filter {
  const byId = new Map(items.map((item) => [item.id, item]));
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach((listener) => listener());
  let query = '';
  let color: ColorName | null = null;
  let dye: 'all' | 'dyeable' | 'plain' = 'all';
  let creationOnly = false;

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search by name';
  search.className = 'w-full rounded border border-black/20 bg-white px-2 py-1';
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    changed();
  });

  const swatches = document.createElement('div');
  swatches.className = 'flex flex-wrap items-center gap-1';
  const swatchButtons = COLORS.map(({ name, swatch }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = name[0].toUpperCase() + name.slice(1);
    button.ariaLabel = `Only ${name}`;
    button.style.backgroundColor = swatch;
    button.className = 'h-6 w-6 rounded-full border-2 border-black/25 aria-pressed:scale-110 aria-pressed:border-black';
    button.addEventListener('click', () => {
      color = color === name ? null : name;
      swatchButtons.forEach((other, i) => (other.ariaPressed = String(COLORS[i].name === color)));
      changed();
    });
    button.ariaPressed = 'false';
    return button;
  });
  swatches.append(...swatchButtons);

  const bar = document.createElement('div');
  bar.className = 'flex flex-col gap-2';
  bar.append(search, swatches);

  const extras: HTMLElement[] = [];
  if (options.dyeable) extras.push(dyeChoice());
  if (options.creation) extras.push(checkbox('New game only', (on) => (creationOnly = on)));
  if (extras.length) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-4';
    row.append(...extras);
    bar.append(row);
  }

  function dyeChoice(): HTMLElement {
    const choices = [
      ['all', 'All'],
      ['dyeable', 'Dyeable'],
      ['plain', 'Not dyeable'],
    ] as const;
    const group = document.createElement('div');
    group.role = 'group';
    group.ariaLabel = 'Dyeable';
    group.className = 'flex gap-1';
    const buttons = choices.map(([value, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className =
        'rounded border border-black/20 bg-white px-2 py-0.5 hover:bg-white/70 aria-pressed:bg-black aria-pressed:text-white';
      button.addEventListener('click', () => {
        dye = value;
        sync();
        changed();
      });
      return button;
    });
    const sync = () => buttons.forEach((button, i) => (button.ariaPressed = String(choices[i][0] === dye)));
    sync();
    group.append(...buttons);
    return group;
  }

  function checkbox(label: string, set: (on: boolean) => void): HTMLLabelElement {
    const element = document.createElement('label');
    element.className = 'flex items-center gap-2';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'h-4 w-4';
    box.addEventListener('change', () => {
      set(box.checked);
      changed();
    });
    element.append(box, label);
    return element;
  }

  return {
    bar,
    matches: (id) => {
      const item = id === null ? undefined : byId.get(id);
      if (!item) return true;
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (color && !item.anyColor && !item.colors.has(color)) return false;
      if (dye === 'dyeable' && !item.dyeable) return false;
      if (dye === 'plain' && item.dyeable) return false;
      if (creationOnly && !item.creation) return false;
      return true;
    },
    onChange: (listener) => listeners.push(listener),
  };
}
