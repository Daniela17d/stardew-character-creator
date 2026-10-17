import { ACCESSORY_NAMES } from './accessory-names.ts';
import type { Catalog, Rgb } from './catalog/types.ts';
import type { Outfit } from './outfit.ts';
import type { Direction } from './render/animation.ts';
import { BODY_X, BODY_Y, type FarmerRenderer, type Parts } from './render/farmer.ts';
import { SCALE, type Rect, type Surface } from './render/pixels.ts';

export interface ViewState {
  outfit: Outfit;
  direction: Direction;
  walking: boolean;
}

interface Choice<T> {
  value: T;
  label?: string;
  caption?: string;
  picture: HTMLElement;
}

const LABEL = 'font-semibold';
const BUTTON = 'rounded border border-black/20 bg-white hover:bg-white/70 aria-pressed:bg-black aria-pressed:text-white';
const TAB =
  'rounded border border-black/20 bg-white px-4 py-1 font-semibold hover:bg-white/70 aria-selected:border-[#8B4513] aria-selected:bg-[#8B4513] aria-selected:text-white';
const OPTION =
  'flex flex-col items-center rounded border-2 border-transparent bg-white/50 p-1 text-xs font-semibold hover:bg-white aria-pressed:border-[#8B4513] aria-pressed:bg-white';

const FULL_BODY = bodyArea(0, 0, 16, 32);
const BUST = bodyArea(0, 0, 16, 20);
const HEAD = bodyArea(0, 0, 16, 24);
const TORSO = bodyArea(2, 13, 12, 12);
const LEGS = bodyArea(0, 16, 16, 16);
const FEET = bodyArea(0, 24, 16, 8);
const WHOLE_HAT: Rect = { x: 0, y: 0, width: 20 * SCALE, height: 20 * SCALE };

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
  const sections: { tab: HTMLButtonElement; section: HTMLElement; paint: () => void }[] = [];
  let active = 0;

  const show = (index: number) => {
    active = index;
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
    grid.className = 'grid grid-cols-[6rem_auto] items-start gap-x-3 gap-y-3 text-sm';
    tabs.append(tab);
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

  const bare = (): Parts => ({ male: outfit.male, skin: outfit.skin, eyeColor: outfit.eyeColor });

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
    colorInput(outfit.eyeColor, (value) => {
      outfit.eyeColor = value;
    }),
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
        paint(accessoryPictures[i], renderer.render({ ...bare(), accessory: id, hairColor: outfit.hairColor }), BUST),
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
    colorInput(outfit.hairColor, (value) => {
      outfit.hairColor = value;
    }),
  );
  hair.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin, outfit.eyeColor, outfit.hairColor],
      () =>
        catalog.hairstyles.forEach((style, i) =>
          paint(hairPictures[i], renderer.render({ ...bare(), hairstyle: style.id, hairColor: outfit.hairColor }), HEAD),
        ),
    ),
  );

  const shirt = section('Shirt');
  const shirtColor = colorInput(outfit.shirtColor, (value) => {
    outfit.shirtColor = value;
  });
  const syncShirtColor = () => {
    shirtColor.disabled = !catalog.shirts.find((item) => item.id === outfit.shirt)?.dyeable;
    shirtColor.value = toHex(outfit.shirtColor);
  };
  const shirtPictures = catalog.shirts.map(() => thumbnail('h-12 w-12'));
  shirt.row(
    'Style',
    choiceGrid(
      catalog.shirts.map((item, i) => {
        const number = item.creation ? String((item.sprite.y / 32) * 16 + item.sprite.x / 8 + 1) : '';
        return { value: item.id, label: number, caption: newGameCaption(item.name, number), picture: shirtPictures[i] };
      }),
      'grid-cols-6',
      () => outfit.shirt,
      (id) => {
        outfit.shirt = id;
        outfit.shirtColor = catalog.shirts.find((item) => item.id === id)?.color ?? outfit.shirtColor;
        syncShirtColor();
      },
    ),
  );
  shirt.row('Colour', shirtColor);
  syncShirtColor();
  shirt.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin],
      () => catalog.shirts.forEach((item, i) => paint(shirtPictures[i], renderer.render({ ...bare(), shirt: item.id }), TORSO)),
    ),
  );

  const pants = section('Pants');
  const pantsColor = colorInput(outfit.pantsColor, (value) => {
    outfit.pantsColor = value;
  });
  const syncPantsColor = () => {
    pantsColor.disabled = !catalog.pants.find((item) => item.id === outfit.pants)?.dyeable;
    pantsColor.value = toHex(outfit.pantsColor);
  };
  const pantsPictures = catalog.pants.map(() => thumbnail('h-12 w-12'));
  pants.row(
    'Style',
    choiceGrid(
      catalog.pants.map((item, i) => {
        const number = item.creation ? String((item.sprite.y / 688) * 10 + item.sprite.x / 192 + 1) : '';
        return { value: item.id, label: number, caption: newGameCaption(item.name, number), picture: pantsPictures[i] };
      }),
      'grid-cols-6',
      () => outfit.pants,
      (id) => {
        outfit.pants = id;
        outfit.pantsColor = catalog.pants.find((item) => item.id === id)?.color ?? outfit.pantsColor;
        syncPantsColor();
      },
    ),
  );
  pants.row('Colour', pantsColor);
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
        ...catalog.hats.map((item, i) => ({ value: item.id, caption: item.name, picture: hatPictures[i] })),
      ],
      'grid-cols-7',
      () => outfit.hat,
      (id) => (outfit.hat = id),
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
        ...catalog.boots.map((item, i) => ({ value: item.id, caption: item.name, picture: bootsPictures[i] })),
      ],
      'grid-cols-6',
      () => outfit.boots,
      (id) => (outfit.boots = id),
    ),
  );
  boots.paintWith(
    whenChanged(
      () => [outfit.male, outfit.skin],
      () => catalog.boots.forEach((item, i) => paint(bootsPictures[i], renderer.render({ ...bare(), boots: item.id }), FEET)),
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
): HTMLElement {
  const field = document.createElement('div');
  field.className = 'flex flex-col gap-2';
  const grid = document.createElement('div');
  grid.className = `grid ${columns} gap-2 ${choices.length > 40 ? 'max-h-96 overflow-y-auto p-1' : ''}`;
  const labelled = choices.some((choice) => choice.label);
  const captioned = choices.some((choice) => choice.caption);
  const caption = document.createElement('p');
  caption.className = 'font-semibold';
  const describe = (value: T) => {
    caption.textContent = choices.find((choice) => choice.value === value)?.caption ?? '';
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

  field.append(grid);
  if (captioned) field.append(caption);
  if (note) {
    const text = document.createElement('p');
    text.className = 'text-xs italic text-black/60';
    text.textContent = note;
    field.append(text);
  }
  return field;
}

function newGameCaption(name: string, number: string): string {
  return number ? `${name} · new game #${number}` : name;
}

function bodyArea(left: number, top: number, width: number, height: number): Rect {
  return { x: BODY_X + left * SCALE, y: BODY_Y + top * SCALE, width: width * SCALE, height: height * SCALE };
}

function thumbnail(size: string): HTMLCanvasElement {
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

function paint(canvas: HTMLCanvasElement, surface: Surface, area: Rect): void {
  canvas.width = area.width;
  canvas.height = area.height;
  canvas.getContext('2d')!.putImageData(new ImageData(surface.toStraightAlpha(), surface.width, surface.height), -area.x, -area.y);
}

function whenChanged(key: () => unknown[], draw: () => void): () => void {
  let drawnFor: string | null = null;
  return () => {
    const next = JSON.stringify(key());
    if (next === drawnFor) return;
    drawnFor = next;
    draw();
  };
}

function colorInput(value: Rgb, onChange: (value: Rgb) => void): HTMLInputElement {
  const element = document.createElement('input');
  element.type = 'color';
  element.value = toHex(value);
  element.className = 'h-8 w-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30';
  element.addEventListener('input', () => onChange(fromHex(element.value)));
  return element;
}

function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function fromHex(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}
