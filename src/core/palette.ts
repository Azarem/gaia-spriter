/**
 * Sprite palettes: 8 rows x 16 colours of 15-bit BGR (CGRAM $80-$FF), 256 bytes.
 */

export const PALETTE_ROWS = 8;
export const COLORS_PER_ROW = 16;

function expand5(value: number): number {
  return Math.round(((value & 0x1f) * 255) / 31);
}

/** Convert a 256-byte BGR555 block to RGBA8 (128 colours x 4 bytes). */
export function paletteToRgba(block: Uint8Array): Uint8Array {
  const colors = block.length >> 1;
  const rgba = new Uint8Array(colors * 4);
  for (let i = 0; i < colors; i++) {
    const word = block[i * 2] | (block[i * 2 + 1] << 8);
    rgba[i * 4] = expand5(word);
    rgba[i * 4 + 1] = expand5(word >> 5);
    rgba[i * 4 + 2] = expand5(word >> 10);
    rgba[i * 4 + 3] = 0xff;
  }
  return rgba;
}
