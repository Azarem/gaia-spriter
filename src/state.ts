import type { BundleLoader, LoadedBundle } from './data/bundle-loader';
import type { PayloadManifest, SpriteGroup, SpritePart, SpriteSet } from './shared/types';

/** The single mutable application state, shared by reference with every pane. */
export interface AppState {
  manifest: PayloadManifest;
  loader: BundleLoader;
  current: LoadedBundle | null;
  setIndex: number;
  frameIndex: number;
  /** Selected part, -1 when the group has none. */
  partIndex: number;
  /** Sprite palette row (0-7) used to draw the GFX page. */
  paletteRow: number;
  /** GFX page shown (0 = page 1, 1 = page 2). */
  page: number;
  /** Tile (0-255) clicked on the GFX page, or null. */
  gfxTile: number | null;
  playing: boolean;
}

export function currentSet(state: AppState): SpriteSet | null {
  return state.current?.collection.sets[state.setIndex] ?? null;
}

export function currentGroup(state: AppState): SpriteGroup | null {
  const set = currentSet(state);
  const frame = set?.frames[state.frameIndex];
  if (!state.current || !frame) return null;
  return state.current.collection.groups[frame.group] ?? null;
}

export function currentPart(state: AppState): SpritePart | null {
  return currentGroup(state)?.parts[state.partIndex] ?? null;
}

/** Strip the collection prefix from a label (`spm_dao_sprites_sprite_group_0001` -> `sprite_group_0001`). */
export function shortLabel(state: AppState, label: string): string {
  const prefix = state.current ? `${state.current.collection.id}_` : '';
  return prefix && label.startsWith(prefix) ? label.slice(prefix.length) : label;
}
