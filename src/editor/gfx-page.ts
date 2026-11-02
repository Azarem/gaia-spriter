import { selectGfxTile, selectPage } from '../controller';
import { decodeTileWord, hex, partPixelSize } from '../core/sprite';
import { PAGE_PIXELS, PAGE_TILES_WIDE } from '../core/tile-decoder';
import { currentPart, type AppState } from '../state';
import { events } from '../ui/events';

const SCALE = 2;
const PART_OUTLINE = '#ff4466';
const TILE_OUTLINE = '#ffffff';

/** Right column, upper: one 128x128 page at 2x with the selected palette row and Page 1 / Page 2 toggles. */
export function initGfxPage(state: AppState): void {
  const canvas = document.getElementById('gfx-canvas') as HTMLCanvasElement;
  const info = document.getElementById('gfx-info') as HTMLElement;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('#gfx-tabs [data-page]')];
  const ctx = canvas.getContext('2d')!;
  const offscreen = document.createElement('canvas');
  offscreen.width = offscreen.height = PAGE_PIXELS;
  const offCtx = offscreen.getContext('2d')!;

  const draw = (): void => {
    const current = state.current;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    buttons.forEach((b) => b.classList.toggle('active', Number(b.dataset.page) === state.page));
    if (!current) return;

    offCtx.putImageData(current.gfx.renderPage(state.page, state.paletteRow), 0, 0);
    ctx.drawImage(offscreen, 0, 0, PAGE_PIXELS * SCALE, PAGE_PIXELS * SCALE);

    // Outline the tiles the selected part uses (only when it lives on the shown page).
    const part = currentPart(state);
    if (part) {
      const word = decodeTileWord(part.tile);
      if (word.page === state.page) {
        const tiles = partPixelSize(part) / 8;
        const col = word.tile & 0x0f;
        const row = word.tile >> 4;
        ctx.strokeStyle = PART_OUTLINE;
        ctx.lineWidth = 2;
        // Tiles wrap inside the 16x16 grid; outline each one separately so wrapped parts stay correct.
        for (let ty = 0; ty < tiles; ty++) {
          for (let tx = 0; tx < tiles; tx++) {
            const x = ((col + tx) & 0x0f) * 8 * SCALE;
            const y = ((row + ty) & 0x0f) * 8 * SCALE;
            ctx.strokeRect(x + 1, y + 1, 8 * SCALE - 2, 8 * SCALE - 2);
          }
        }
      }
    }

    if (state.gfxTile !== null) {
      const x = (state.gfxTile & 0x0f) * 8 * SCALE;
      const y = (state.gfxTile >> 4) * 8 * SCALE;
      ctx.strokeStyle = TILE_OUTLINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 8 * SCALE - 1, 8 * SCALE - 1);
      const word = (state.page << 8) | state.gfxTile;
      info.textContent = `tile $${hex(word, 3)}`;
    } else if (part) {
      info.textContent = `part tile $${hex(part.tile & 0x1ff, 3)}`;
    } else {
      info.textContent = '';
    }
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * PAGE_TILES_WIDE);
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * PAGE_TILES_WIDE);
    if (px < 0 || py < 0 || px >= PAGE_TILES_WIDE || py >= PAGE_TILES_WIDE) return;
    selectGfxTile(state, py * PAGE_TILES_WIDE + px);
  });

  buttons.forEach((b) => b.addEventListener('click', () => selectPage(state, Number(b.dataset.page))));

  events.onAny(
    ['bundle:changed', 'set:selected', 'frame:selected', 'part:selected', 'palette:selected', 'page:selected', 'gfx:selected'],
    draw,
  );
}
