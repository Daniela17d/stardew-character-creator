export type Direction = 'down' | 'right' | 'up' | 'left';

export interface AnimationFrame {
  frame: number;
  flip: boolean;
  armOffset: number;
  positionOffset: number;
  xOffset: number;
}

export const WALK_FRAME_MS = 200;

function walk(frames: number[], flip = false): AnimationFrame[] {
  return frames.map((frame) => ({ frame, flip, armOffset: 6, positionOffset: 0, xOffset: 0 }));
}

export const WALK: Record<Direction, AnimationFrame[]> = {
  down: walk([1, 0, 2, 0]),
  right: walk([7, 6, 8, 6]),
  up: walk([13, 12, 14, 12]),
  left: walk([7, 6, 8, 6], true),
};

export const IDLE: Record<Direction, AnimationFrame> = {
  down: WALK.down[1],
  right: WALK.right[1],
  up: WALK.up[1],
  left: WALK.left[1],
};

export const FEATURE_X_OFFSET = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 4, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const FEATURE_Y_OFFSET = [
  1, 2, 2, 0, 5, 6, 1, 2, 2, 1, 0, 2, 0, 1, 1, 0, 2, 2, 3, 3, 2, 2, 1, 1, 0, 0, 2, 2, 4, 4, 0, 0, 1,
  2, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, -2, -1, 1, 1, 0, -1, -2, -1, -1, 5, 4, 0, 0, 3, 2, -1, 0, 4,
  2, 0, 0, 2, 1, 0, -1, 1, -2, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, -1, -1, -1, -1, 1, 1, 0, 0, 0,
  0, 4, 1, 0, 1, 2, 1, 0, 1, 0, 1, 2, -3, -4, -1, 0, 0, 2, 1, -4, -1, 0, 0, -3, 0, 0, -1, 0, 0, 2, 1,
  1,
];
