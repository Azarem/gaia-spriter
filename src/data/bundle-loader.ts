import { BundleGraphics, GroupRenderer } from '../core/renderer';
import type { ManifestBundle, PayloadManifest, SpriteCollection } from '../shared/types';

/** Everything needed to display one bundle. */
export interface LoadedBundle {
  bundle: ManifestBundle;
  collection: SpriteCollection;
  gfx: BundleGraphics;
  renderer: GroupRenderer;
}

function need(files: Map<string, Uint8Array>, path: string): Uint8Array {
  const data = files.get(path);
  if (!data) throw new Error(`payload.zip is missing ${path}`);
  return data;
}

/** Loads collections and bundle graphics out of the unzipped payload (collections are parsed once). */
export class BundleLoader {
  private collections = new Map<string, SpriteCollection>();

  constructor(
    private readonly manifest: PayloadManifest,
    private readonly files: Map<string, Uint8Array>,
  ) {}

  private collection(id: string): SpriteCollection {
    let collection = this.collections.get(id);
    if (!collection) {
      const entry = this.manifest.collections.find((c) => c.id === id);
      if (!entry) throw new Error(`Manifest has no collection "${id}"`);
      collection = JSON.parse(new TextDecoder().decode(need(this.files, entry.file))) as SpriteCollection;
      this.collections.set(id, collection);
    }
    return collection;
  }

  load(bundleId: string): LoadedBundle {
    const bundle = this.manifest.bundles.find((b) => b.id === bundleId);
    if (!bundle) throw new Error(`Unknown bundle "${bundleId}"`);
    const gfx = new BundleGraphics(need(this.files, bundle.page1), need(this.files, bundle.page2), need(this.files, bundle.palettes));
    return { bundle, collection: this.collection(bundle.collection), gfx, renderer: new GroupRenderer(gfx) };
  }
}
