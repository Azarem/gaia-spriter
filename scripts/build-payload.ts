/**
 * Build payload.zip from data/spriteset-bundles.json and the extracted baserom.
 *
 * Usage: npm run payload            (reads GAIA_IOG_BASEROM or ../gaia-iog-baserom)
 *
 * payload.zip layout:
 *   manifest.json                 PayloadManifest (bundles + collections)
 *   collections/<id>.json         SpriteCollection (sets, frames, groups, parts)
 *   pages/<hash>.bin              8192-byte sprite page (128x128, 4bpp planar)
 *   palettes/<hash>.bin           256-byte sprite palette block (8 x 16 BGR555 colours, CGRAM $80-$FF)
 *
 * Pages and palette blocks are de-duplicated by content hash, so bundles that share art share files.
 * Any problem (missing file, dangling group reference, bad range) fails the build.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zipSync, type Zippable } from 'fflate';
import { Baserom } from './lib/baserom.ts';
import { BUNDLES_PATH, SPRITER_ROOT, baseromRoot } from './lib/paths.ts';
import { buildCollection, parseSpriteAsm } from './lib/sprite-asm.ts';
import { PAGE_BYTES, PAYLOAD_VERSION, SPRITE_COLORS } from '../src/shared/types.ts';
import type {
  BundlesFile,
  ManifestBundle,
  ManifestCollection,
  PageSource,
  PaletteSource,
  PayloadManifest,
  SpriteBundle,
  SpriteCollection,
} from '../src/shared/types.ts';

const OUT_PATH = path.join(SPRITER_ROOT, 'payload.zip');

function hash(data: Uint8Array): string {
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 12);
}

function failIf(condition: boolean, message: string): void {
  if (condition) throw new Error(message);
}

function buildPage(baserom: Baserom, source: PageSource, label: string): Uint8Array {
  const page = new Uint8Array(PAGE_BYTES);
  const data = baserom.readFile(source.file);
  failIf(source.srcOffset < 0 || source.dstOffset < 0 || source.length < 0, `${label}: negative offset or length`);
  failIf(source.dstOffset >= PAGE_BYTES, `${label}: dstOffset ${source.dstOffset} is outside the page`);
  failIf(source.srcOffset > data.length, `${label}: srcOffset ${source.srcOffset} is beyond ${source.file} (${data.length} bytes)`);
  const length = Math.min(source.length, PAGE_BYTES - source.dstOffset, data.length - source.srcOffset);
  page.set(data.subarray(source.srcOffset, source.srcOffset + length), source.dstOffset);
  return page;
}

function buildPalettes(baserom: Baserom, defaultFile: string, loads: PaletteSource[], label: string): Uint8Array {
  const block = new Uint8Array(SPRITE_COLORS * 2);
  const base = baserom.readFile(defaultFile);
  failIf(base.length < 32, `${label}: default palette ${defaultFile} is shorter than 16 colours`);
  for (let row = 0; row < 8; row++) block.set(base.subarray(0, 32), row * 32);

  for (const load of loads) {
    failIf(load.dstColor < 0 || load.dstColor + load.count > SPRITE_COLORS, `${label}: palette run ${load.file} does not fit the sprite palettes`);
    const data = baserom.readFile(load.file);
    const start = load.srcColor * 2;
    const end = start + load.count * 2;
    failIf(end > data.length, `${label}: palette ${load.file} has ${data.length / 2} colours, run needs ${load.srcColor + load.count}`);
    block.set(data.subarray(start, end), load.dstColor * 2);
  }
  return block;
}

function main(): void {
  const baserom = new Baserom(baseromRoot());
  const bundlesFile = JSON.parse(fs.readFileSync(BUNDLES_PATH, 'utf-8')) as BundlesFile;
  failIf(!Array.isArray(bundlesFile.bundles) || bundlesFile.bundles.length === 0, `${BUNDLES_PATH} has no bundles (run "npm run bundles")`);

  const zip: Zippable = {};
  const addOnce = (zipPath: string, data: Uint8Array): void => {
    if (!zip[zipPath]) zip[zipPath] = data;
  };

  // Collections (parsed once each).
  const collections = new Map<string, SpriteCollection>();
  const collectionNeeds = new Map<string, SpriteBundle['source']>();
  const seenIds = new Set<string>();
  for (const bundle of bundlesFile.bundles) {
    failIf(seenIds.has(bundle.id), `Duplicate bundle id "${bundle.id}"`);
    seenIds.add(bundle.id);
    const previous = collectionNeeds.get(bundle.collection);
    failIf(previous !== undefined && previous !== bundle.source, `Collection "${bundle.collection}" used with two sources`);
    collectionNeeds.set(bundle.collection, bundle.source);
  }

  const warnings: string[] = [];
  let trimmed = 0;
  for (const [id, source] of collectionNeeds) {
    const asmPath = baserom.collectionAsmPath(id, source);
    failIf(!fs.existsSync(asmPath), `Collection "${id}": extracted asm missing (${asmPath})`);
    const parsed = parseSpriteAsm(baserom.readText(asmPath), path.relative(baserom.root, asmPath));
    warnings.push(...parsed.warnings);
    trimmed += parsed.trimmedGroups;
    collections.set(id, buildCollection(id, parsed));
  }

  const manifestCollections: ManifestCollection[] = [];
  for (const [id, collection] of collections) {
    const file = `collections/${id}.json`;
    zip[file] = new TextEncoder().encode(JSON.stringify(collection));
    manifestCollections.push({ id, file, setCount: collection.sets.length });
  }

  // Bundles.
  const manifestBundles: ManifestBundle[] = bundlesFile.bundles.map((bundle) => {
    const label = `bundle ${bundle.id}`;
    failIf(!collections.has(bundle.collection), `${label}: unknown collection ${bundle.collection}`);
    const page1 = buildPage(baserom, bundle.page1, `${label} page1`);
    const page2 = bundle.page2 ? buildPage(baserom, bundle.page2, `${label} page2`) : new Uint8Array(PAGE_BYTES);
    const palettes = buildPalettes(baserom, bundlesFile.defaults.palette, bundle.palettes, label);

    const page1Path = `pages/${hash(page1)}.bin`;
    const page2Path = `pages/${hash(page2)}.bin`;
    const palettePath = `palettes/${hash(palettes)}.bin`;
    addOnce(page1Path, page1);
    addOnce(page2Path, page2);
    addOnce(palettePath, palettes);

    return {
      id: bundle.id,
      label: bundle.label,
      collection: bundle.collection,
      scenes: bundle.scenes,
      page1: page1Path,
      page2: page2Path,
      palettes: palettePath,
    };
  });

  const manifest: PayloadManifest = {
    game: bundlesFile.game,
    version: PAYLOAD_VERSION,
    bundles: manifestBundles,
    collections: manifestCollections,
  };
  zip['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));

  const bytes = zipSync(zip, { level: 9 });
  fs.writeFileSync(OUT_PATH, bytes);

  const pageCount = Object.keys(zip).filter((k) => k.startsWith('pages/')).length;
  const paletteCount = Object.keys(zip).filter((k) => k.startsWith('palettes/')).length;
  console.log(`Wrote ${OUT_PATH} (${(bytes.length / 1024).toFixed(0)} KB)`);
  console.log(`  ${manifestBundles.length} bundles, ${manifestCollections.length} collections, ${pageCount} unique pages, ${paletteCount} unique palette blocks`);
  if (trimmed > 0) console.log(`  ${trimmed} group(s) had extracted parts past their header count (trimmed to the count)`);
  for (const w of warnings) console.log(`  warning: ${w}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
}
