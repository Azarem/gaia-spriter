import { decodeTileWord } from './core/sprite';
import { currentGroup, currentPart, type AppState } from './state';
import { events } from './ui/events';

/** Selection logic. Every change goes through here so the panes only react to events. */

/** Make the GFX page and palette row follow the selected part. */
function followPart(state: AppState): void {
  const part = currentPart(state);
  if (!part) return;
  const word = decodeTileWord(part.tile);
  state.paletteRow = word.palette;
  state.page = word.page;
}

/** Select the first part of the current group and follow it. */
function resetPart(state: AppState): void {
  state.partIndex = (currentGroup(state)?.parts.length ?? 0) > 0 ? 0 : -1;
  state.gfxTile = null;
  followPart(state);
}

export function selectBundle(state: AppState, bundleId: string): void {
  stopPlayback(state);
  state.current = state.loader.load(bundleId);
  state.setIndex = 0;
  state.frameIndex = 0;
  resetPart(state);
  events.emit('bundle:changed');
}

export function selectSet(state: AppState, index: number): void {
  if (!state.current || index < 0 || index >= state.current.collection.sets.length) return;
  stopPlayback(state);
  state.setIndex = index;
  state.frameIndex = 0;
  resetPart(state);
  events.emit('set:selected');
}

export function selectFrame(state: AppState, index: number): void {
  const frames = state.current?.collection.sets[state.setIndex]?.frames;
  if (!frames || index < 0 || index >= frames.length) return;
  state.frameIndex = index;
  resetPart(state);
  events.emit('frame:selected');
}

export function selectPart(state: AppState, index: number): void {
  const parts = currentGroup(state)?.parts;
  if (!parts || index < 0 || index >= parts.length) return;
  state.partIndex = index;
  state.gfxTile = null;
  followPart(state);
  events.emit('part:selected');
}

export function selectPalette(state: AppState, row: number): void {
  if (row < 0 || row > 7) return;
  state.paletteRow = row;
  events.emit('palette:selected');
}

export function selectPage(state: AppState, page: number): void {
  if (page !== 0 && page !== 1) return;
  state.page = page;
  events.emit('page:selected');
}

export function selectGfxTile(state: AppState, tile: number | null): void {
  state.gfxTile = tile;
  events.emit('gfx:selected');
}

export function setPlaying(state: AppState, playing: boolean): void {
  if (state.playing === playing) return;
  state.playing = playing;
  events.emit('playback:changed');
}

export function stopPlayback(state: AppState): void {
  setPlaying(state, false);
}
