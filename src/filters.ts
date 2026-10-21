import { COLORS, type ColorName } from './item-colors.ts';

export interface FilterItem {
  id: string;
  name: string;
  colors: Set<ColorName>;
  anyColor: boolean;
  dyeable?: boolean;
  creation?: boolean;
  tailorable?: boolean;
  buyable?: boolean;
}

type Way = 'tailorable' | 'buyable' | 'neither';

export interface Filter {
  bar: HTMLElement;
  matches: (id: string | null) => boolean;
  onChange: (listener: () => void) => void;
}

export function gameCheckbox(box: HTMLInputElement, size: number): HTMLImageElement {
  box.classList.add('peer', 'sr-only');
  const icon = new Image(size, size);
  icon.alt = '';
  icon.className =
    '[image-rendering:pixelated] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#8B4513]';
  const sync = () => {
    icon.src = `${import.meta.env.BASE_URL}ui/${box.checked ? 'checkbox-on' : 'checkbox'}.png`;
  };
  box.addEventListener('change', sync);
  sync();
  return icon;
}

export function createFilter(
  items: FilterItem[],
  options: { dyeable?: boolean; creation?: boolean; obtain?: boolean } = {},
): Filter {
  const byId = new Map(items.map((item) => [item.id, item]));
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach((listener) => listener());
  let query = '';
  let color: ColorName | null = null;
  let dye: 'all' | 'dyeable' | 'plain' = 'all';
  let creationOnly = false;
  const ways = new Set<Way>();

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search by name';
  search.ariaLabel = 'Search by name';
  search.className =
    'h-9 min-w-0 flex-1 border-x-[12px] border-y-0 border-solid bg-transparent px-1 [image-rendering:pixelated] placeholder:text-black/50';
  search.style.borderImage = `url(${import.meta.env.BASE_URL}ui/text-box.png) 0 16 fill / 0 12px stretch`;
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    changed();
  });
  const magnifier = new Image(32, 32);
  magnifier.src = `${import.meta.env.BASE_URL}ui/search.png`;
  magnifier.alt = '';
  magnifier.className = '[image-rendering:pixelated]';
  const searchRow = document.createElement('div');
  searchRow.className = 'flex items-center gap-2';
  searchRow.append(magnifier, search);

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
  bar.append(searchRow, swatches);

  const extras: HTMLElement[] = [];
  if (options.dyeable) extras.push(dyeChoice());
  if (options.creation) extras.push(checkbox('New game only', (on) => (creationOnly = on)));
  if (extras.length) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-4';
    row.append(...extras);
    bar.append(row);
  }

  if (options.obtain) {
    const tailoring = items.some((item) => item.tailorable);
    const choices: [Way, string, string][] = [
      ['tailorable', 'Tailorable', 'Made at the sewing machine'],
      ['buyable', 'Buyable', 'Sold in a shop'],
      ['neither', tailoring ? 'Neither' : 'Not buyable', tailoring ? "Can't be tailored or bought" : "Can't be bought"],
    ];
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-4';
    for (const [way, label, hint] of choices) {
      if (way === 'tailorable' && !tailoring) continue;
      const box = checkbox(label, (on) => (on ? ways.add(way) : ways.delete(way)));
      box.title = hint;
      row.append(box);
    }
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
        'rounded border-2 border-transparent bg-white/50 px-2 py-0.5 font-semibold hover:bg-white aria-pressed:border-[#8B4513] aria-pressed:bg-white';
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
    element.className = 'flex cursor-pointer items-center gap-2';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => {
      set(box.checked);
      changed();
    });
    element.append(box, gameCheckbox(box, 18), label);
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
      if (ways.size && ![...ways].some((way) => (way === 'neither' ? !item.tailorable && !item.buyable : item[way]))) return false;
      return true;
    },
    onChange: (listener) => listeners.push(listener),
  };
}
