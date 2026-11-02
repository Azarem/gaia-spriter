import { selectBundle } from '../controller';
import { events } from '../ui/events';
import type { AppState } from '../state';

/** Banner dropdown listing every bundle preset. */
export function initBundleSelector(state: AppState): void {
  const select = document.getElementById('bundle-selector') as HTMLSelectElement;
  const info = document.getElementById('bundle-info') as HTMLElement;

  select.innerHTML = '';
  for (const bundle of state.manifest.bundles) {
    const option = document.createElement('option');
    option.value = bundle.id;
    option.textContent = bundle.label;
    select.appendChild(option);
  }
  select.disabled = false;

  select.addEventListener('change', () => {
    selectBundle(state, select.value);
    select.blur();
  });

  events.on('bundle:changed', () => {
    const current = state.current;
    if (!current) return;
    select.value = current.bundle.id;
    const scenes = current.bundle.scenes.map((s) => '$' + s.toString(16).toUpperCase().padStart(2, '0'));
    info.textContent = scenes.length > 0 ? `scenes: ${scenes.join(' ')}` : 'no scene binding (defaults)';
    info.title = info.textContent;
  });
}
