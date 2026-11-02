import { selectPart } from '../controller';
import { groupBounds } from '../core/sprite';
import { currentGroup, currentSet, type AppState } from '../state';
import { CanvasView } from '../ui/canvas-view';
import { events } from '../ui/events';
import { observeSize } from '../ui/layout';

/** Flat backdrop behind the group (matches the design mockup). */
const BACKDROP = '#2f7b80';
const OUTLINE = '#ff4466';

/**
 * Centre pane: the current group drawn at the actor origin. The view frames the union of every group in the
 * selected set so playback does not jump around; the group's own bounds get the teal backdrop.
 */
export function initPreview(state: AppState): void {
  const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
  const panel = document.getElementById('preview-panel') as HTMLElement;

  const view = new CanvasView({
    canvas,
    onDraw: (ctx, zoom) => {
      const group = currentGroup(state);
      if (!group || !state.current) return;
      const image = state.current.renderer.render(group);
      const x = -image.originX;
      const y = -image.originY;
      ctx.fillStyle = BACKDROP;
      ctx.fillRect(x, y, image.width, image.height);
      ctx.drawImage(image.canvas, x, y);

      const rect = image.partRects[state.partIndex];
      if (rect) {
        ctx.strokeStyle = OUTLINE;
        // Two screen pixels wide, drawn just inside the part so neighbouring parts stay readable.
        const lw = 2 / zoom;
        ctx.lineWidth = lw;
        ctx.strokeRect(x + rect.x + lw / 2, y + rect.y + lw / 2, rect.w - lw, rect.h - lw);
      }
    },
    onClick: (cx, cy) => {
      const group = currentGroup(state);
      if (!group || !state.current) return;
      const image = state.current.renderer.render(group);
      const px = cx + image.originX;
      const py = cy + image.originY;
      // Parts earlier in the list are drawn on top, so test them first.
      for (let i = 0; i < image.partRects.length; i++) {
        const r = image.partRects[i];
        if (px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h) {
          selectPart(state, i);
          return;
        }
      }
    },
  });

  /** Union of every group's bounds in the selected set (origin space). */
  const setFocus = (keepPan: boolean): void => {
    const set = currentSet(state);
    const current = state.current;
    if (!set || !current) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const frame of set.frames) {
      const b = groupBounds(current.collection.groups[frame.group]);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (!Number.isFinite(minX)) return;
    view.setFocus({ minX, minY, maxX, maxY }, keepPan);
  };

  observeSize(panel, (w, h) => view.resize(w, h));

  events.onAny(['bundle:changed', 'set:selected'], () => setFocus(false));
  events.onAny(['frame:selected', 'part:selected'], () => view.redraw());
}
