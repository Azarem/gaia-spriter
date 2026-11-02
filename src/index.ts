import { selectBundle } from './controller';
import { BundleLoader } from './data/bundle-loader';
import { readManifest } from './data/manifest';
import { clearCache, fetchPayload } from './data/payload';
import { initBundleSelector } from './editor/bundle-selector';
import { initGfxPage } from './editor/gfx-page';
import { initPaletteViewer } from './editor/palette-viewer';
import { initPartsList } from './editor/parts-list';
import { initPreview } from './editor/preview';
import { initProperties } from './editor/properties';
import { initSetList } from './editor/set-list';
import { initTimeline } from './editor/timeline';
import { PAYLOAD_VERSION } from './shared/types';
import type { AppState } from './state';

const PAYLOAD_URL = 'payload.zip';

async function main(): Promise<void> {
  const files = await fetchPayload(PAYLOAD_URL, PAYLOAD_VERSION);
  const manifest = readManifest(files);

  const state: AppState = {
    manifest,
    loader: new BundleLoader(manifest, files),
    current: null,
    setIndex: 0,
    frameIndex: 0,
    partIndex: -1,
    paletteRow: 0,
    page: 0,
    gfxTile: null,
    playing: false,
  };

  // Panes subscribe to events first; the first selectBundle then fills them.
  initBundleSelector(state);
  initSetList(state);
  initTimeline(state);
  initPartsList(state);
  initProperties(state);
  initPreview(state);
  initGfxPage(state);
  initPaletteViewer(state);

  selectBundle(state, manifest.bundles[0].id);

  // Debug handle for the browser console.
  (window as unknown as { gaiaSpriter: unknown }).gaiaSpriter = { state, clearCache };
}

main().catch((error: unknown) => {
  console.error(error);
  const select = document.getElementById('bundle-selector') as HTMLSelectElement | null;
  if (select) select.innerHTML = `<option>Error: ${(error as Error).message}</option>`;
});
