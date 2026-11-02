# Architecture

Vanilla TypeScript (strict), HTML5 Canvas 2D with `imageSmoothingEnabled = false`, `fflate` for the payload ZIP, bundled by `tsdown` into the IIFE `dist/app.iife.js` (global `GaiaSpriter`). The page `index.html` is a static shell; `styles.css` holds a CSS grid with heavy dividers that follows the design mockup.

## Terms

| Term | Meaning |
|------|---------|
| collection | One pointer table: a `Spritemap` file (`spm_*.sprite.asm`) or a `&sprite-set` block (`spriteset_*`, `inventory_spritemap`) |
| set | One pointer-table entry (e.g. `transform_pose_00`): a `sprite-set < hold, &group >` list, i.e. an animation |
| frame | One record of a set: a group plus its hold time |
| group | One `sprite-group`: a header (extents, hit box, body box) and its parts |
| part | One `sprite-part < size, x, x', y, y', tile >` |
| bundle | A collection plus two graphics pages and eight sprite palettes (see [bundles.md](bundles.md)) |

## Source data format

```
spriteset_x [ &set_a ;00  &set_b ;01 ... ]                  pointer table
set_a [ sprite-set < #hold, &group_1 >  sprite-set < ... > ]  frames (shown for hold + 1 ticks)
group_1 [ sprite-group < #l, #r, #t, #b, h0..h3, b0..b3, #count, [
            sprite-part < #size, #x, #x', #y, #y', #$tile >
          ] > ]
```

- Header bytes: extents (left, right, top, bottom of the box around the actor origin), hit box (4 raw bytes), body box (4 raw bytes), part count.
- Part: `size` 0 = 8x8, 1 = 16x16. `x` / `y` are offsets inside the extent box, so the position relative to the actor origin is `(x - left, y - top)`. `x'` / `y'` are the mirrored offsets the engine uses for a flipped actor (the viewer shows them as X-Mirror / Y-Mirror).
- Tile word: bits 0-7 tile number, bit 8 page (name table), bits 9-11 palette row, bits 12-13 priority, `$4000` H flip, `$8000` V flip.

## Rendering

- `core/tile-decoder.ts` decodes the planar 4bpp tiles of a page once into palette indices.
- `core/renderer.ts`: `BundleGraphics` holds the two decoded pages and the palette as RGBA; `GroupRenderer` composites a group into an offscreen canvas and caches it per group id (thumbnails and the preview share it). Parts are drawn back to front (OAM entry 0 is on top), colour 0 is transparent, and a 16x16 part uses tiles N, N+1, N+16, N+17 with wrap inside the 16x16 tile grid. Flips mirror both the tile order and the pixels.
- The image covers the extent box united with every part, so parts outside the header extents are not clipped. The actor origin is kept as `originX/originY` in the image.

## Runtime

```
payload.zip --fetch--> IndexedDB cache --unzip--> Map<path, bytes>
  readManifest -> BundleLoader.load(bundleId) -> LoadedBundle { collection, gfx, renderer }
```

`AppState` (`src/state.ts`) is the single mutable state. All selection changes go through `src/controller.ts`, which updates the state and emits an event on the typed bus (`src/ui/events.ts`); the panes only subscribe.

| Event | Emitted when | Reset side effects |
|-------|--------------|--------------------|
| `bundle:changed` | bundle loaded | set 0, frame 0, part 0 |
| `set:selected` | set clicked | frame 0, part 0, playback stops |
| `frame:selected` | timeline cell clicked, or playback tick | part 0 |
| `part:selected` | parts list / preview click | palette row and page follow the part |
| `palette:selected`, `page:selected`, `gfx:selected` | GFX / palette panes | none |
| `playback:changed` | Play / Pause | none |

## Panes (`src/editor`)

`bundle-selector`, `set-list`, `timeline` (thumbnails + playback), `parts-list`, `properties`, `preview` (uses `ui/canvas-view.ts`: integer zoom, drag pan, click hit-test), `gfx-page`, `palette-viewer`.

## Out of scope in v1

Editing parts, undo/redo, exporting `.sprite.asm`, a layers dropdown. The data model (`src/shared/types.ts`) and the controller are structured so those can be added later.
