/**
 * Data model shared by the build scripts and the browser app.
 *
 * Two JSON shapes live here:
 *  - `BundlesFile`   : data/spriteset-bundles.json (written by generate-bundles, hand-editable).
 *  - `PayloadManifest`: manifest.json inside payload.zip (written by build-payload, read by the app).
 */

/* ------------------------------------------------------------------ */
/*  Sprite data (parsed from .sprite.asm / spriteset_*.asm)            */
/* ------------------------------------------------------------------ */

/** One `sprite-part < size, x, x', y, y', tile >` record. */
export interface SpritePart {
  /** 0 = 8x8, 1 = 16x16 (the OAM size bit). */
  size: number;
  /** Offset inside the group's extent box (pixels, 0-255). */
  x: number;
  /** Mirrored X offset used when the actor is flipped. */
  x2: number;
  /** Offset inside the group's extent box (pixels, 0-255). */
  y: number;
  /** Mirrored Y offset used when the actor is flipped. */
  y2: number;
  /** OAM word: tile low byte, bit 8 name table, bits 9-11 palette, 12-13 priority, $4000 H flip, $8000 V flip. */
  tile: number;
}

/** One `sprite-group` (a drawn frame image). */
export interface SpriteGroup {
  /** Label of the group (e.g. `sprite_group_0FCB30`). */
  id: string;
  /** Header bytes 0-3: X extent left, right, Y extent top, bottom. */
  extents: [number, number, number, number];
  /** Header bytes 4-7: tile-unit collision box (raw bytes). */
  hitBox: [number, number, number, number];
  /** Header bytes 8-11: body box (raw bytes: X offset, width, Y offset, height). */
  bodyBox: [number, number, number, number];
  parts: SpritePart[];
}

/** One `sprite-set < hold, &group >` frame record. */
export interface SpriteFrame {
  /** The frame is shown for hold + 1 ticks. */
  hold: number;
  /** Id of a group in the same collection. */
  group: string;
}

/** One pointer-table entry: a list of frames. */
export interface SpriteSet {
  /** Label of the sprite-set record (e.g. `transform_pose_00`). */
  id: string;
  frames: SpriteFrame[];
}

/** A pointer table plus every group it can reach. */
export interface SpriteCollection {
  /** Collection id: file stem (`spm_dao_sprites`) or block name (`spriteset_freedan`). */
  id: string;
  sets: SpriteSet[];
  groups: Record<string, SpriteGroup>;
}

/* ------------------------------------------------------------------ */
/*  data/spriteset-bundles.json                                        */
/* ------------------------------------------------------------------ */

/**
 * A run of bytes copied from a decompressed graphics file into one 128x128 sprite page
 * (256 tiles x 32 bytes = 8192 bytes). The rest of the page stays zero.
 */
export interface PageSource {
  /** File name without extension (bare name as used by files.json / scene_meta). */
  file: string;
  /** Byte offset into the file where the copy starts. */
  srcOffset: number;
  /** Number of bytes to copy (clipped to the page and the file). */
  length: number;
  /** Byte offset inside the page where the copy lands. */
  dstOffset: number;
}

/** A run of colours copied from a palette file into the 8 sprite palettes (128 colours). */
export interface PaletteSource {
  /** File name without extension. */
  file: string;
  /** First colour (2-byte unit) in the file. */
  srcColor: number;
  /** Number of colours. */
  count: number;
  /** Destination colour inside the sprite palette block, 0-127 (CGRAM colour minus 128). */
  dstColor: number;
}

export type BundleSource = 'spritemap' | 'sprite-set';

export interface SpriteBundle {
  /** Unique id, e.g. `spm_dao_sprites` or `spm_dao_sprites#2`. */
  id: string;
  /** Text shown in the bundle selector. */
  label: string;
  /** Collection id (`SpriteCollection.id`). */
  collection: string;
  /** Where the collection comes from. */
  source: BundleSource;
  /** Scene ids (generator: scenes whose scene_meta record loads this collection). */
  scenes: number[];
  /** True once the entry was edited by hand; the generator never rewrites it. */
  locked?: boolean;
  page1: PageSource;
  page2: PageSource | null;
  palettes: PaletteSource[];
}

export interface BundleDefaults {
  page1: PageSource;
  /** Palette file (16 colours) used for every sprite palette a bundle does not write. */
  palette: string;
}

export interface BundlesFile {
  game: string;
  defaults: BundleDefaults;
  bundles: SpriteBundle[];
}

/* ------------------------------------------------------------------ */
/*  payload.zip manifest                                               */
/* ------------------------------------------------------------------ */

export interface ManifestBundle {
  id: string;
  label: string;
  collection: string;
  scenes: number[];
  /** Zip path of the 8192-byte page 1 image. */
  page1: string;
  /** Zip path of the 8192-byte page 2 image. */
  page2: string;
  /** Zip path of the 256-byte sprite palette block (8 x 16 BGR555 colours). */
  palettes: string;
}

export interface ManifestCollection {
  id: string;
  /** Zip path of the collection JSON (`SpriteCollection`). */
  file: string;
  setCount: number;
}

export interface PayloadManifest {
  game: string;
  version: number;
  bundles: ManifestBundle[];
  collections: ManifestCollection[];
}

/** Payload format version. Bump when the manifest or the files in payload.zip change shape (busts the IndexedDB cache). */
export const PAYLOAD_VERSION = 1;
/** Bytes in one sprite page: 256 tiles x 32 bytes (a 128x128 pixel 4bpp image). */
export const PAGE_BYTES = 8192;
/** Colours in the 8 sprite palettes (CGRAM $80-$FF). */
export const SPRITE_COLORS = 128;
