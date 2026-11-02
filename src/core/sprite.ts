import type { SpriteGroup, SpritePart } from '../shared/types';

/** The fields packed into a sprite part's OAM tile word. */
export interface TileWord {
  /** Tile number inside the page (low byte, 0-255). */
  tile: number;
  /** 0 or 1: name table bit (bit 8) = which of the two 128x128 pages. */
  page: number;
  /** Sprite palette row 0-7 (bits 9-11). */
  palette: number;
  /** Priority 0-3 (bits 12-13). */
  priority: number;
  hFlip: boolean;
  vFlip: boolean;
}

export function decodeTileWord(word: number): TileWord {
  return {
    tile: word & 0xff,
    page: (word >> 8) & 1,
    palette: (word >> 9) & 7,
    priority: (word >> 12) & 3,
    hFlip: (word & 0x4000) !== 0,
    vFlip: (word & 0x8000) !== 0,
  };
}

/** Pixel size of a part (8 or 16). */
export function partPixelSize(part: SpritePart): number {
  return part.size ? 16 : 8;
}

/** Position of a part relative to the actor origin (the extent box is origin-centred: x - left, y - top). */
export function partOrigin(group: SpriteGroup, part: SpritePart): { x: number; y: number } {
  return { x: part.x - group.extents[0], y: part.y - group.extents[2] };
}

/** Bounding box of a group relative to the actor origin: the extent box united with every part. */
export function groupBounds(group: SpriteGroup): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = -group.extents[0];
  let maxX = group.extents[1];
  let minY = -group.extents[2];
  let maxY = group.extents[3];
  for (const part of group.parts) {
    const p = partOrigin(group, part);
    const size = partPixelSize(part);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + size);
    maxY = Math.max(maxY, p.y + size);
  }
  return { minX, minY, maxX, maxY };
}

export function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}
