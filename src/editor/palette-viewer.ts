import { selectPalette } from '../controller';
import { COLORS_PER_ROW, PALETTE_ROWS } from '../core/palette';
import type { AppState } from '../state';
import { events } from '../ui/events';

const SWATCH = 16;
const ACTIVE_OUTLINE = '#ff2020';

/** Right column, below the GFX page: the 8 sprite palettes (CGRAM $80-$FF) as 16-colour rows; click selects a row. */
export function initPaletteViewer(state: AppState): void {
  const canvas = document.getElementById('palette-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  const draw = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const current = state.current;
    if (!current) return;
    const rgba = current.gfx.rgba;
    for (let row = 0; row < PALETTE_ROWS; row++) {
      for (let col = 0; col < COLORS_PER_ROW; col++) {
        const c = (row * COLORS_PER_ROW + col) * 4;
        ctx.fillStyle = `rgb(${rgba[c]},${rgba[c + 1]},${rgba[c + 2]})`;
        ctx.fillRect(col * SWATCH, row * SWATCH, SWATCH, SWATCH);
      }
    }
    ctx.strokeStyle = ACTIVE_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, state.paletteRow * SWATCH + 1, COLORS_PER_ROW * SWATCH - 2, SWATCH - 2);
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    selectPalette(state, Math.floor(((e.clientY - rect.top) / rect.height) * PALETTE_ROWS));
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLORS_PER_ROW);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * PALETTE_ROWS);
    const current = state.current;
    if (!current || row < 0 || row >= PALETTE_ROWS || col < 0 || col >= COLORS_PER_ROW) return;
    const i = (row * COLORS_PER_ROW + col) * 2;
    const word = current.gfx.paletteWords[i] | (current.gfx.paletteWords[i + 1] << 8);
    canvas.title = `palette ${row}, colour ${col} (CGRAM $${(0x80 + row * 16 + col).toString(16).toUpperCase()}): BGR555 $${word
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')}`;
  });

  events.onAny(['bundle:changed', 'part:selected', 'frame:selected', 'set:selected', 'palette:selected'], draw);
}
