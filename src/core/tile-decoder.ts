/**
 * SNES 4bpp planar tile decoding.
 *
 * Each 8x8 tile is 32 bytes: bitplanes 0/1 interleaved by row in bytes 0-15, bitplanes 2/3 in bytes 16-31.
 * A sprite page is 256 tiles (8192 bytes) laid out 16 tiles wide, i.e. a 128x128 pixel image.
 */

export const TILE_BYTES = 32;
export const TILES_PER_PAGE = 256;
export const PAGE_TILES_WIDE = 16;
export const PAGE_PIXELS = 128;

/** Decode one 8x8 tile starting at `offset` into 64 palette indices (0-15). */
export function decodeTile8x8(data: Uint8Array, offset: number, out: Uint8Array, outOffset: number): void {
  for (let row = 0; row < 8; row++) {
    const bp0 = data[offset + row * 2] ?? 0;
    const bp1 = data[offset + row * 2 + 1] ?? 0;
    const bp2 = data[offset + 16 + row * 2] ?? 0;
    const bp3 = data[offset + 16 + row * 2 + 1] ?? 0;
    for (let col = 0; col < 8; col++) {
      const bit = 7 - col;
      out[outOffset + row * 8 + col] =
        ((bp0 >> bit) & 1) | (((bp1 >> bit) & 1) << 1) | (((bp2 >> bit) & 1) << 2) | (((bp3 >> bit) & 1) << 3);
    }
  }
}

/** Decode a whole 8192-byte sprite page into 256 x 64 palette indices (tile n at n * 64). */
export function decodePage(page: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILES_PER_PAGE * 64);
  for (let tile = 0; tile < TILES_PER_PAGE; tile++) {
    decodeTile8x8(page, tile * TILE_BYTES, out, tile * 64);
  }
  return out;
}
