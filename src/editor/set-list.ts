import { selectSet } from '../controller';
import { hex } from '../core/sprite';
import { shortLabel, type AppState } from '../state';
import { events } from '../ui/events';

/** Left column, top: one `label (frames)` line per pointer-table entry of the collection (frame count in hex). */
export function initSetList(state: AppState): void {
  const root = document.getElementById('set-list') as HTMLElement;
  let rows: HTMLElement[] = [];

  const rebuild = (): void => {
    root.innerHTML = '';
    rows = [];
    const sets = state.current?.collection.sets ?? [];
    if (sets.length === 0) {
      root.innerHTML = '<div class="text-empty">No sets</div>';
      return;
    }
    sets.forEach((set, index) => {
      const row = document.createElement('div');
      row.className = 'text-row';
      row.textContent = `${shortLabel(state, set.id)} (${hex(set.frames.length, 1)})`;
      row.title = set.id;
      row.addEventListener('click', () => selectSet(state, index));
      root.appendChild(row);
      rows.push(row);
    });
    highlight();
  };

  const highlight = (): void => {
    rows.forEach((row, i) => row.classList.toggle('selected', i === state.setIndex));
    rows[state.setIndex]?.scrollIntoView({ block: 'nearest' });
  };

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') selectSet(state, state.setIndex + 1);
    else if (e.key === 'ArrowUp') selectSet(state, state.setIndex - 1);
    else return;
    e.preventDefault();
  });

  events.on('bundle:changed', rebuild);
  events.on('set:selected', highlight);
}
