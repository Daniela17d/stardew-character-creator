export const ACCESSORY_COUNT = 30;
export const NEW_FARMER_SHOE_COLOR = 2;
export const HAT_OFFSET_BY_HAIRSTYLE = [0, 0, 0, 4, 0, 0, 3, 0, 4, 0, 0, 0, 0, 0, 0, 0];

export function isFacialHair(accessory: number): boolean {
  return accessory < 6 || (accessory >= 19 && accessory <= 22);
}

export function isBelowHair(accessory: number): boolean {
  return accessory < 8 || isFacialHair(accessory);
}

export function isBaldHairstyle(hairstyle: number): boolean {
  return hairstyle >= 49 && hairstyle <= 55;
}

const KEPT_UNDER_HATS = new Set([
  1, 5, 6, 9, 11, 17, 20, 23, 24, 25, 27, 28, 29, 30, 32, 33, 34, 36, 39, 41, 43, 44, 45, 46, 47,
  50, 51, 52, 53, 54, 55,
]);

const REPLACED_UNDER_HATS = new Map([
  [3, 11],
  [18, 23],
  [19, 23],
  [21, 23],
  [31, 23],
  [42, 46],
  [48, 6],
  [49, 52],
]);


export function obscuredHairstyle(hairstyle: number): number {
  if (hairstyle >= 100 || KEPT_UNDER_HATS.has(hairstyle)) return hairstyle;
  return REPLACED_UNDER_HATS.get(hairstyle) ?? (hairstyle < 16 ? 7 : 30);
}
