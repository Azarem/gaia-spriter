import { selectFrame, setPlaying } from '../controller';
import { hex } from '../core/sprite';
import { currentSet, shortLabel, type AppState } from '../state';
import { events } from '../ui/events';

const THUMB_BOX = 72;
const THUMB_MAX_SCALE = 3;
const TICK_MS = 1000 / 60;

/**
 * Top of the centre/right columns: one cell per frame of the selected set, left to right, as
 * `group label (parts)` with a thumbnail. Also drives playback (a frame shows for hold + 1 ticks at 60 Hz).
 */
export function initTimeline(state: AppState): void {
  const strip = document.getElementById('timeline') as HTMLElement;
  const title = document.getElementById('timeline-title') as HTMLElement;
  const playButton = document.getElementById('btn-play') as HTMLButtonElement;
  let cells: HTMLElement[] = [];
  let timer: number | undefined;

  const rebuild = (): void => {
    strip.innerHTML = '';
    cells = [];
    const set = currentSet(state);
    const current = state.current;
    if (!set || !current) {
      title.textContent = '';
      playButton.disabled = true;
      return;
    }
    title.textContent = `${shortLabel(state, set.id)}: ${set.frames.length} frame${set.frames.length === 1 ? '' : 's'}`;
    playButton.disabled = set.frames.length < 2;

    set.frames.forEach((frame, index) => {
      const group = current.collection.groups[frame.group];
      const cell = document.createElement('div');
      cell.className = 'timeline-cell';
      cell.title = `${frame.group}\nframe ${index}, hold ${frame.hold} (${frame.hold + 1} ticks)`;

      const label = document.createElement('div');
      label.textContent = `${shortLabel(state, frame.group)} (${hex(group.parts.length, 1)})`;
      cell.appendChild(label);

      const image = current.renderer.render(group);
      const scaleRaw = Math.min(THUMB_MAX_SCALE, THUMB_BOX / Math.max(1, image.width, image.height));
      const scale = scaleRaw >= 1 ? Math.floor(scaleRaw) : scaleRaw;
      const thumb = document.createElement('canvas');
      thumb.width = Math.max(1, Math.round(image.width * scale));
      thumb.height = Math.max(1, Math.round(image.height * scale));
      const ctx = thumb.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image.canvas, 0, 0, thumb.width, thumb.height);
      cell.appendChild(thumb);

      cell.addEventListener('click', () => selectFrame(state, index));
      strip.appendChild(cell);
      cells.push(cell);
    });
    highlight();
  };

  const highlight = (): void => {
    cells.forEach((cell, i) => cell.classList.toggle('selected', i === state.frameIndex));
    cells[state.frameIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const stopTimer = (): void => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };

  const scheduleNext = (): void => {
    stopTimer();
    if (!state.playing) return;
    const set = currentSet(state);
    if (!set || set.frames.length < 2) return;
    const hold = set.frames[state.frameIndex].hold;
    timer = window.setTimeout(() => {
      const next = (state.frameIndex + 1) % set.frames.length;
      selectFrame(state, next);
    }, (hold + 1) * TICK_MS);
  };

  playButton.addEventListener('click', () => setPlaying(state, !state.playing));

  events.onAny(['bundle:changed', 'set:selected'], rebuild);
  events.on('frame:selected', () => {
    highlight();
    scheduleNext();
  });
  events.on('playback:changed', () => {
    playButton.textContent = state.playing ? '\u275A\u275A Pause' : '\u25B6 Play';
    playButton.classList.toggle('active', state.playing);
    scheduleNext();
  });
}
