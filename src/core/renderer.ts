/**
 * Sprite rendering: composites sprite groups from two decoded 128x128 pages and the sprite palettes.
 */

import type { SpriteGroup } from '../shared/types';
import { COLORS_PER_ROW, paletteToRgba } from './palette';
import { groupBounds, partOrigin, partPixelSize, decodeTileWord } from './sprite';
import { PAGE_PIXELS, PAGE_TILES_WIDE, decodePage } from './tile-decoder';

/** Backdrop drawn behind colour 0 of the GFX page (matches the design mockup). */
export const GFX_BACKDROP: readonly [number, number, number] = [0x00, 0x90, 0x10];

/** Decoded graphics of one bundle: two pages of palette indices plus the sprite palettes as RGBA. */
export class BundleGraphics {
  /** 2 x (256 tiles x 64 indices). */
  readonly pages: [Uint8Array, Uint8Array];
  /** 128 colours x RGBA. */
  readonly rgba: Uint8Array;
  /** Raw 8 x 16 BGR555 block (256 bytes), kept for display of colour values. */
  readonly paletteWords: Uint8Array;

  constructor(page1: Uint8Array, page2: Uint8Array, paletteBlock: Uint8Array) {
    this.pages = [decodePage(page1), decodePage(page2)];
    this.rgba = paletteToRgba(paletteBlock);
    this.paletteWords = paletteBlock;
  }

  /** Palette index (0-15) of pixel (px, py) of the 128x128 page. */
  pixel(page: number, px: number, py: number): number {
    const tile = (py >> 3) * PAGE_TILES_WIDE + (px >> 3);
    return this.pages[page][tile * 64 + (py & 7) * 8 + (px & 7)];
  }

  /** Render a page (128x128) with one palette row; colour 0 shows the backdrop. */
  renderPage(page: number, paletteRow: number): ImageData {
    const data = new Uint8ClampedArray(PAGE_PIXELS * PAGE_PIXELS * 4);
    const base = paletteRow * COLORS_PER_ROW;
    for (let py = 0; py < PAGE_PIXELS; py++) {
      for (let px = 0; px < PAGE_PIXELS; px++) {
        const idx = this.pixel(page, px, py);
        const o = (py * PAGE_PIXELS + px) * 4;
        if (idx === 0) {
          data[o] = GFX_BACKDROP[0];
          data[o + 1] = GFX_BACKDROP[1];
          data[o + 2] = GFX_BACKDROP[2];
        } else {
          const c = (base + idx) * 4;
          data[o] = this.rgba[c];
          data[o + 1] = this.rgba[c + 1];
          data[o + 2] = this.rgba[c + 2];
        }
        data[o + 3] = 0xff;
      }
    }
    return new ImageData(data, PAGE_PIXELS, PAGE_PIXELS);
  }
}

/** A rendered group plus the geometry needed to map between image pixels and the actor origin. */
export interface GroupImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Pixel of the actor origin inside the image. */
  originX: number;
  originY: number;
  /** Rect of each part in image pixels, in part order. */
  partRects: { x: number; y: number; w: number; h: number }[];
}

/** Renders groups for one bundle and caches the result per group. */
export class GroupRenderer {
  private cache = new Map<string, GroupImage>();

  constructor(readonly gfx: BundleGraphics) {}

  render(group: SpriteGroup): GroupImage {
    const cached = this.cache.get(group.id);
    if (cached) return cached;

    const b = groupBounds(group);
    const width = b.maxX - b.minX;
    const height = b.maxY - b.minY;
    const originX = -b.minX;
    const originY = -b.minY;
    const data = new Uint8ClampedArray(width * height * 4);
    const partRects: GroupImage['partRects'] = [];

    // OAM entry 0 has the highest priority, so draw the parts back to front.
    for (let i = group.parts.length - 1; i >= 0; i--) {
      const part = group.parts[i];
      const p = partOrigin(group, part);
      const size = partPixelSize(part);
      const word = decodeTileWord(part.tile);
      const tilesAcross = size / 8;
      const dx = p.x + originX;
      const dy = p.y + originY;

      for (let ty = 0; ty < tilesAcross; ty++) {
        for (let tx = 0; tx < tilesAcross; tx++) {
          // Source tile inside the part (flips swap tile positions as well as pixels).
          const srcTx = word.hFlip ? tilesAcross - 1 - tx : tx;
          const srcTy = word.vFlip ? tilesAcross - 1 - ty : ty;
          const col = ((word.tile & 0x0f) + srcTx) & 0x0f;
          const row = ((word.tile >> 4) + srcTy) & 0x0f;
          const tileNo = row * PAGE_TILES_WIDE + col;
          const tileBase = tileNo * 64;
          const pageData = this.gfx.pages[word.page];

          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const sx = word.hFlip ? 7 - x : x;
              const sy = word.vFlip ? 7 - y : y;
              const idx = pageData[tileBase + sy * 8 + sx];
              if (idx === 0) continue;
              const px = dx + tx * 8 + x;
              const py = dy + ty * 8 + y;
              if (px < 0 || py < 0 || px >= width || py >= height) continue;
              const c = (word.palette * COLORS_PER_ROW + idx) * 4;
              const o = (py * width + px) * 4;
              data[o] = this.gfx.rgba[c];
              data[o + 1] = this.gfx.rgba[c + 1];
              data[o + 2] = this.gfx.rgba[c + 2];
              data[o + 3] = 0xff;
            }
          }
        }
      }
    }
    for (const part of group.parts) {
      const p = partOrigin(group, part);
      const size = partPixelSize(part);
      partRects.push({ x: p.x + originX, y: p.y + originY, w: size, h: size });
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    if (width > 0 && height > 0) canvas.getContext('2d')!.putImageData(new ImageData(data, width, height), 0, 0);

    const image: GroupImage = { canvas, width, height, originX, originY, partRects };
    this.cache.set(group.id, image);
    return image;
  }
}
