/**
 * Create / refresh data/spriteset-bundles.json.
 *
 * Usage: npm run bundles            (reads GAIA_IOG_BASEROM or ../gaia-iog-baserom)
 *
 * 1. Lists every `Spritemap` file in db-us/files.json and every `&sprite-set` block in db-us/blocks.json.
 * 2. Walks every scene_meta record (following jump / label / both branch outcomes). For each `spritemap`
 *    command the sprite-VRAM bitmap (mode 1) and the palettes written at colour $80 or higher that were
 *    loaded before it become the page 2 image and the sprite palettes of a bundle.
 * 3. One bundle per distinct (page 1, page 2, palettes) combination of a spritemap, with the scene ids
 *    that use it. Collections no scene loads (all spriteset_* tables) get the defaults only.
 * 4. Merges with the existing file: bundles marked `"locked": true` are kept verbatim.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Baserom } from './lib/baserom.ts';
import { BUNDLES_PATH, baseromRoot } from './lib/paths.ts';
import { collectSpritemapHits, parseSceneMeta, type SpriteLoadState } from './lib/scene-meta.ts';
import { PAGE_BYTES, SPRITE_COLORS } from '../src/shared/types.ts';
import type { BundlesFile, PageSource, PaletteSource, SpriteBundle } from '../src/shared/types.ts';

const DEFAULT_PAGE1_FILE = 'gfx_000000';
const DEFAULT_PALETTE_FILE = 'fx_palette_198020';
/** scene_meta bitmap units: 512 bytes. Sprite VRAM = 2 pages of 8192 bytes. */
const BITMAP_UNIT = 0x200;

interface Signature {
  page1: PageSource | null;
  page2: PageSource | null;
  palettes: PaletteSource[];
}

/** Convert one scene's loaded state into page sources and palette runs. */
function signatureOf(state: SpriteLoadState, warn: (msg: string) => void): Signature {
  const pages: (PageSource | null)[] = [null, null];

  for (const bmp of state.bitmaps) {
    const srcOffset = bmp.start * BITMAP_UNIT;
    const length = (bmp.end - bmp.start) * BITMAP_UNIT;
    let abs = bmp.dst * BITMAP_UNIT;
    let src = srcOffset;
    let remaining = length;
    while (remaining > 0 && abs < PAGE_BYTES * 2) {
      const page = abs >= PAGE_BYTES ? 1 : 0;
      const pageStart = page * PAGE_BYTES;
      const chunk = Math.min(remaining, pageStart + PAGE_BYTES - abs);
      if (pages[page]) warn(`page ${page + 1} loaded more than once (${pages[page]!.file}, then ${bmp.file}); the last load wins`);
      pages[page] = { file: bmp.file, srcOffset: src, length: chunk, dstOffset: abs - pageStart };
      abs += chunk;
      src += chunk;
      remaining -= chunk;
    }
    if (remaining > 0) warn(`bitmap ${bmp.file} overruns sprite VRAM by ${remaining} bytes (clipped)`);
  }

  const palettes: PaletteSource[] = [];
  for (const pal of state.palettes) {
    const dstColor = pal.dst - 0x80;
    let count = pal.end - pal.start;
    if (dstColor + count > SPRITE_COLORS) {
      warn(`palette ${pal.file} overruns the sprite palettes (clipped)`);
      count = SPRITE_COLORS - dstColor;
    }
    palettes.push({ file: pal.file, srcColor: pal.start, count, dstColor });
  }
  return { page1: pages[0], page2: pages[1], palettes };
}

function sceneText(ids: number[]): string {
  const hex = ids.map((n) => '$' + n.toString(16).toUpperCase().padStart(2, '0'));
  return hex.length <= 3 ? hex.join(' ') : `${hex.slice(0, 3).join(' ')} +${hex.length - 3}`;
}

function main(): void {
  const baserom = new Baserom(baseromRoot());
  const warnings: string[] = [];
  const defaults: BundlesFile['defaults'] = {
    page1: { file: DEFAULT_PAGE1_FILE, srcOffset: 0, length: PAGE_BYTES, dstOffset: 0 },
    palette: DEFAULT_PALETTE_FILE,
  };
  for (const name of [defaults.page1.file, defaults.palette]) {
    if (!baserom.hasFile(name)) throw new Error(`Default asset "${name}" is not in files.json`);
  }

  const spritemaps = baserom.filesOfType('Spritemap').map((f) => f.name);
  const blocks = baserom.blocksOfType('&sprite-set').map((b) => b.name);
  console.log(`files.json Spritemap: ${spritemaps.length}, blocks.json &sprite-set: ${blocks.length}`);

  const sceneRecords = parseSceneMeta(baserom.readText(path.join(baserom.extracted, 'tables', 'scene_meta.asm')));
  const { hits, warnings: walkWarnings } = collectSpritemapHits(sceneRecords);
  warnings.push(...walkWarnings);
  console.log(`scene_meta: ${sceneRecords.length} records, ${hits.length} spritemap loads`);

  // spritemap -> signature -> scenes
  const bySpritemap = new Map<string, Map<string, { sig: Signature; scenes: Set<number> }>>();
  for (const hit of hits) {
    if (!spritemaps.includes(hit.file)) {
      warnings.push(`scene $${hit.scene.toString(16)} loads "${hit.file}" which is not a Spritemap in files.json`);
      continue;
    }
    const sig = signatureOf(hit.state, (msg) => warnings.push(`scene $${hit.scene.toString(16)} / ${hit.file}: ${msg}`));
    const key = JSON.stringify(sig);
    const variants = bySpritemap.get(hit.file) ?? new Map();
    const variant = variants.get(key) ?? { sig, scenes: new Set<number>() };
    variant.scenes.add(hit.scene);
    variants.set(key, variant);
    bySpritemap.set(hit.file, variants);
  }

  const generated: SpriteBundle[] = [];

  for (const name of spritemaps) {
    const variants = [...(bySpritemap.get(name)?.values() ?? [])];
    if (variants.length === 0) {
      warnings.push(`${name}: no scene loads this spritemap; using default page 1 / palette only`);
      generated.push({ id: name, label: name, collection: name, source: 'spritemap', scenes: [], page1: { ...defaults.page1 }, page2: null, palettes: [] });
      continue;
    }
    const sorted = variants
      .map((v) => ({ ...v, scenes: [...v.scenes].sort((a, b) => a - b) }))
      .sort((a, b) => a.scenes[0] - b.scenes[0]);
    sorted.forEach((v, i) => {
      const id = i === 0 ? name : `${name}#${i + 1}`;
      const label = sorted.length === 1 ? name : `${name} #${i + 1} (scene ${sceneText(v.scenes)})`;
      generated.push({
        id,
        label,
        collection: name,
        source: 'spritemap',
        scenes: v.scenes,
        page1: v.sig.page1 ?? { ...defaults.page1 },
        page2: v.sig.page2,
        palettes: v.sig.palettes,
      });
    });
  }

  for (const name of blocks) {
    generated.push({ id: name, label: name, collection: name, source: 'sprite-set', scenes: [], page1: { ...defaults.page1 }, page2: null, palettes: [] });
  }

  // Merge with the existing file: locked bundles survive.
  let existing: BundlesFile | null = null;
  if (fs.existsSync(BUNDLES_PATH)) {
    existing = JSON.parse(fs.readFileSync(BUNDLES_PATH, 'utf-8')) as BundlesFile;
  }
  const locked = new Map((existing?.bundles ?? []).filter((b) => b.locked).map((b) => [b.id, b]));
  const merged: SpriteBundle[] = generated.map((b) => locked.get(b.id) ?? b);
  const generatedIds = new Set(generated.map((b) => b.id));
  for (const [id, b] of locked) if (!generatedIds.has(id)) merged.push(b);
  merged.sort((a, b) => a.id.localeCompare(b.id));

  const out: BundlesFile = { game: 'illusion-of-gaia', defaults: existing?.defaults ?? defaults, bundles: merged };
  fs.mkdirSync(path.dirname(BUNDLES_PATH), { recursive: true });
  fs.writeFileSync(BUNDLES_PATH, JSON.stringify(out, null, 2) + '\n');

  const withPage2 = merged.filter((b) => b.page2).length;
  console.log(`Wrote ${BUNDLES_PATH}`);
  console.log(`  ${merged.length} bundles (${withPage2} with a scene-bound page 2, ${locked.size} locked kept)`);
  if (warnings.length > 0) {
    console.log(`${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
}
