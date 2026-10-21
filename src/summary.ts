import { ACCESSORY_NAMES } from './accessory-names.ts';
import type { Catalog } from './catalog/types.ts';
import { BAR_MAX, barsToRgb, toHex, type Bars } from './color.ts';
import {
  BAR_NAMES,
  BUTTON,
  FEET,
  LEGS,
  TORSO,
  WHOLE_HAT,
  barGradient,
  itemLabels,
  paint,
  pantsNumber,
  shirtNumber,
  thumbnail,
  whenChanged,
  type ViewState,
} from './controls.ts';
import type { FarmerRenderer, Parts } from './render/farmer.ts';
import type { Rect, Surface } from './render/pixels.ts';

interface Line {
  label: string;
  copy: string;
  value: HTMLElement;
  color?: Bars;
}

export function createSummary(
  catalog: Catalog,
  state: ViewState,
  renderer: FarmerRenderer,
): { panel: HTMLElement; refresh: () => void } {
  const panel = document.createElement('div');
  panel.className = 'flex flex-col gap-4';
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-3';
  const title = document.createElement('h2');
  title.className = 'text-lg font-bold';
  title.textContent = 'Summary';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = `px-3 py-1 text-sm font-semibold ${BUTTON}`;
  copy.textContent = 'Copy';
  header.append(title, copy);
  const list = document.createElement('dl');
  list.className = 'grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm';
  panel.append(header, list);

  const shirtNames = itemLabels(catalog.shirts);
  const pantsNames = itemLabels(catalog.pants);
  const hatNames = itemLabels(catalog.hats);
  const bootsNames = itemLabels(catalog.boots);
  let lines: Line[] = [];

  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(lines.map((line) => line.copy).join('\n'));
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  });

  const refresh = whenChanged(
    () => [state.outfit],
    () => {
      const { outfit } = state;
      const base: Parts = { male: outfit.male, skin: outfit.skin, eyeColor: barsToRgb(outfit.eyeColor) };
      const shirt = catalog.shirts.find((item) => item.id === outfit.shirt);
      const pants = catalog.pants.find((item) => item.id === outfit.pants);
      const hat = catalog.hats.find((item) => item.id === outfit.hat);
      const boots = catalog.boots.find((item) => item.id === outfit.boots);

      lines = [
        plainLine('Gender', outfit.male ? 'Male' : 'Female'),
        plainLine('Skin', String(outfit.skin + 1)),
        barsLine('Eye colour', outfit.eyeColor),
        plainLine('Hair', String(catalog.hairstyles.findIndex((style) => style.id === outfit.hairstyle) + 1)),
        barsLine('Hair colour', outfit.hairColor),
        outfit.accessory === null
          ? numberLine('Accessory', '1', 'None')
          : numberLine('Accessory', String(outfit.accessory + 2), ACCESSORY_NAMES[outfit.accessory] ?? 'Accessory'),
      ];
      if (shirt) {
        const name = shirtNames.get(shirt.id) ?? shirt.name;
        const surface = renderer.render({ ...base, shirt: shirt.id, shirtColor: barsToRgb(outfit.shirtColor) });
        lines.push(
          shirtNumber(shirt)
            ? numberLine('Shirt', shirtNumber(shirt), name)
            : pictureLine('Shirt', name, picture(surface, TORSO, 'h-6 w-6')),
        );
        if (shirt.dyeable) lines.push(barsLine('Shirt colour', outfit.shirtColor));
      }
      if (pants) {
        const name = pantsNames.get(pants.id) ?? pants.name;
        const surface = renderer.render({ ...base, pants: pants.id, pantsColor: barsToRgb(outfit.pantsColor) });
        lines.push(
          pantsNumber(pants)
            ? numberLine('Pants', pantsNumber(pants), name)
            : pictureLine('Pants', name, picture(surface, LEGS, 'h-8 w-8')),
        );
        if (pants.dyeable) lines.push(barsLine('Pants colour', outfit.pantsColor));
      }
      lines.push(
        hat
          ? pictureLine('Hat', hatNames.get(hat.id) ?? hat.name, picture(renderer.renderHat(hat.id), WHOLE_HAT, 'h-10 w-10'))
          : plainLine('Hat', 'None'),
        boots
          ? pictureLine(
              'Boots',
              bootsNames.get(boots.id) ?? boots.name,
              picture(renderer.render({ ...base, boots: boots.id }), FEET, 'h-4 w-8'),
            )
          : plainLine('Boots', 'None'),
      );

      list.replaceChildren(
        ...lines.flatMap(({ label, value, color }) => {
          const term = document.createElement('dt');
          term.className = 'font-semibold';
          term.textContent = label;
          if (color) {
            const swatch = document.createElement('span');
            swatch.className = 'mt-1 block h-4 w-4 rounded-sm border border-black/30';
            swatch.style.background = toHex(barsToRgb(color));
            term.append(swatch);
          }
          return [term, value];
        }),
      );
    },
  );
  return { panel, refresh };
}

function plainLine(label: string, text: string): Line {
  const value = document.createElement('dd');
  value.textContent = text;
  return { label, copy: `${label}: ${text}`, value };
}

function numberLine(label: string, number: string, name: string): Line {
  const strong = document.createElement('span');
  strong.className = 'font-semibold';
  strong.textContent = number;
  const muted = document.createElement('span');
  muted.className = 'text-black/60';
  muted.textContent = ` · ${name}`;
  const value = document.createElement('dd');
  value.append(strong, muted);
  return { label, copy: `${label}: ${number} · ${name}`, value };
}

function pictureLine(label: string, name: string, picture: HTMLElement): Line {
  const value = document.createElement('dd');
  value.className = 'flex items-center gap-2';
  value.append(picture, name);
  return { label, copy: `${label}: ${name}`, value };
}

function barsLine(label: string, bars: Bars): Line {
  const value = document.createElement('dd');
  value.className = 'flex flex-col gap-1.5';
  BAR_NAMES.forEach((name, i) => {
    const letter = document.createElement('span');
    letter.title = name;
    letter.className = 'w-3 text-xs font-semibold text-black/60';
    letter.textContent = name[0];
    const marker = document.createElement('span');
    marker.className = 'bar-marker';
    marker.style.left = `calc(0.375rem + (100% - 0.75rem) * ${bars[i] / BAR_MAX})`;
    const track = document.createElement('span');
    track.ariaHidden = 'true';
    track.className = 'relative h-2 flex-1 rounded-full';
    track.style.background = barGradient(bars, i);
    track.append(marker);
    const number = document.createElement('span');
    number.className = 'w-6 text-right font-semibold tabular-nums';
    number.textContent = String(bars[i]);
    const row = document.createElement('span');
    row.className = 'flex items-center gap-2';
    row.append(letter, track, number);
    value.append(row);
  });
  const copy = [`${label}:`, ...BAR_NAMES.map((name, i) => `  ${name[0]}: ${bars[i]}`)].join('\n');
  return { label, copy, value, color: bars };
}

function picture(surface: Surface, area: Rect, size: string): HTMLCanvasElement {
  const canvas = thumbnail(size);
  paint(canvas, surface, area);
  return canvas;
}
