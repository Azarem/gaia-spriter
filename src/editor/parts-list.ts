import { selectPart } from '../controller';
import { hex } from '../core/sprite';
import { currentGroup, type AppState } from '../state';
import { events } from '../ui/events';

/** Left column, middle: the group's parts as raw asm operands: `#size, #x, #x', #y, #y', #$tile`. */
export function initPartsList(state: AppState): void {
  const root = document.getElementById('parts-list') as HTMLElement;
  let rows: HTMLElement[] = [];

  const rebuild = (): void => {
    root.innerHTML = '';
    rows = [];
    const group = currentGroup(state);
    if (!group || group.parts.length === 0) {
      root.innerHTML = '<div class="text-empty">No parts</div>';
      return;
    }
    group.parts.forEach((part, index) => {
      const row = document.createElement('div');
      row.className = 'text-row';
      row.textContent =
        `#${hex(part.size, 2)}, #${hex(part.x, 2)}, #${hex(part.x2, 2)}, #${hex(part.y, 2)}, #${hex(part.y2, 2)}, #$${hex(part.tile, 4)}`;
      row.title = `part ${index}`;
      row.addEventListener('click', () => selectPart(state, index));
      root.appendChild(row);
      rows.push(row);
    });
    highlight();
  };

  const highlight = (): void => {
    rows.forEach((row, i) => row.classList.toggle('selected', i === state.partIndex));
    rows[state.partIndex]?.scrollIntoView({ block: 'nearest' });
  };

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') selectPart(state, state.partIndex + 1);
    else if (e.key === 'ArrowUp') selectPart(state, state.partIndex - 1);
    else return;
    e.preventDefault();
  });

  events.onAny(['bundle:changed', 'set:selected', 'frame:selected'], rebuild);
  events.on('part:selected', highlight);
}
