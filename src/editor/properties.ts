import { decodeTileWord, hex } from '../core/sprite';
import { currentGroup, currentPart, type AppState } from '../state';
import { events } from '../ui/events';

/** Left column, bottom (read-only): selected part fields decoded from the asm operands, plus the group boxes. */
export function initProperties(state: AppState): void {
  const root = document.getElementById('properties') as HTMLElement;

  const row = (name: string, value: string): string =>
    `<div class="prop-row"><span class="prop-name">${name}</span><span class="prop-value">${value}</span></div>`;
  const yesNo = (v: boolean): string => (v ? 'Yes' : 'No');
  const dec = (v: number): string => `${v} ($${hex(v, 2)})`;
  const list = (v: number[]): string => v.map((n) => hex(n, 2)).join(' ');

  const render = (): void => {
    const part = currentPart(state);
    const group = currentGroup(state);
    let html = '<div class="prop-heading">Part</div>';
    if (part) {
      const w = decodeTileWord(part.tile);
      html += row('X', dec(part.x));
      html += row('Y', dec(part.y));
      html += row('X-Mirror', dec(part.x2));
      html += row('Y-Mirror', dec(part.y2));
      html += row('Size', part.size ? '16x16' : '8x8');
      html += row('Priority', String(w.priority));
      html += row('Palette', String(w.palette));
      html += row('H-Flip', yesNo(w.hFlip));
      html += row('V-Flip', yesNo(w.vFlip));
      html += row('Tile', `$${hex(w.tile, 2)} (page ${w.page + 1})`);
    } else {
      html += row('X', '--') + row('Y', '--') + row('X-Mirror', '--') + row('Y-Mirror', '--') + row('Size', '--');
      html += row('Priority', '--') + row('Palette', '--') + row('H-Flip', '--') + row('V-Flip', '--') + row('Tile', '--');
    }
    if (group) {
      html += '<div class="prop-heading">Group</div>';
      html += row('Extents L R T B', list(group.extents));
      html += row('Hit box', list(group.hitBox));
      html += row('Body box', list(group.bodyBox));
    }
    root.innerHTML = html;
  };

  events.onAny(['bundle:changed', 'set:selected', 'frame:selected', 'part:selected'], render);
}
