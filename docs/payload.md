# Payload

`npm run payload` (part of `npm run build`) turns `data/spriteset-bundles.json` and the baserom's `extracted/` folder into `payload.zip`, which the app fetches (and caches in IndexedDB) at startup.

```
payload.zip
├── manifest.json               PayloadManifest
├── collections/<id>.json       SpriteCollection: sets -> frames -> groups -> parts
├── pages/<hash>.bin            8192-byte sprite page (128x128, 4bpp planar, 16 tiles wide)
└── palettes/<hash>.bin         256-byte sprite palette block (8 x 16 BGR555 colours)
```

Pages and palette blocks are named by content hash, so bundles with identical art share files.

## Build steps

1. Read the bundles JSON; every bundle id must be unique.
2. For each referenced collection, parse the extracted asm (`extracted/<group>/<sub>/<name>.sprite.asm` for a `Spritemap`, `extracted/tables/<name>.asm` for a `&sprite-set` block) once. The first pointer table is the list of sets; only groups reachable from it are kept.
3. For each bundle, build page 1 and page 2 (zero filled, then the page source copied in) and the palette block (the default palette repeated in all 8 rows, then the palette runs applied).
4. Write the manifest and zip with level 9.

The build fails on a missing file or collection, a dangling group reference, a group with fewer parts than its header count, or a range that does not fit.

The extraction keeps decoding bytes after a group up to the next referenced label, so some groups list extra "parts" past the header's count byte (21 groups today). The build trims them to the header count, which is what the engine draws, and reports how many it trimmed.

## Format version

`PAYLOAD_VERSION` in `src/shared/types.ts` is part of the IndexedDB cache key and is checked against `manifest.version`. Bump it whenever the manifest or the files in the zip change shape.

## Serving

The payload must be served over HTTP (`fetch`), for example `npm run dev` (`npx serve`).
