import { loadCatalog } from './catalog/load.ts';
import { createEditor, createPreview, type ViewState } from './controls.ts';
import { newFarmer } from './outfit.ts';
import { IDLE, WALK, WALK_FRAME_MS } from './render/animation.ts';
import { FRAME_HEIGHT, FRAME_WIDTH, FarmerRenderer } from './render/farmer.ts';
import { drawSpriteText } from './render/sprite-text.ts';
import { loadTextures } from './render/textures.ts';

const title = document.querySelector<HTMLCanvasElement>('#title')!;
drawSpriteText(title, title.getAttribute('aria-label')!, 3);

const app = document.querySelector<HTMLDivElement>('#app')!;
const catalog = await loadCatalog();
const textures = await loadTextures(catalog);
const renderer = new FarmerRenderer(catalog, textures);

const state: ViewState = { outfit: newFarmer(catalog), direction: 'down', walking: false };

const canvas = document.createElement('canvas');
canvas.width = FRAME_WIDTH;
canvas.height = FRAME_HEIGHT;
canvas.className = 'h-[288px] w-[160px] [image-rendering:pixelated]';
const context = canvas.getContext('2d')!;

const { tabs, panel, refresh } = createEditor(catalog, state, renderer, textures);
const content = document.createElement('div');
content.className = 'flex flex-col items-center gap-8 md:flex-row md:items-start';
content.append(createPreview(canvas, state), panel);
app.append(tabs, content);

let lastDrawn = '';

function draw(time: number): void {
  refresh();
  const frames = WALK[state.direction];
  const step = state.walking ? Math.floor(time / WALK_FRAME_MS) % frames.length : -1;
  const animated = renderer.isAnimated(state.outfit);
  const key = JSON.stringify([state, step, animated ? time : 0]);
  if (key !== lastDrawn) {
    lastDrawn = key;
    const surface = renderer.render(state.outfit, state.direction, step < 0 ? IDLE[state.direction] : frames[step], time);
    context.putImageData(new ImageData(surface.toStraightAlpha(), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);
  }
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
