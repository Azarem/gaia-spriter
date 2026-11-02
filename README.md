# Gaia Spriter

Browser-based, read-only sprite-set viewer for Illusion of Gaia. Pure HTML5 Canvas 2D, no UI framework; the same stack as [gaia-mapper](../gaia-mapper).

Pick a **bundle** (a sprite collection plus the two 128x128 graphics pages and eight 16-colour sprite palettes it is drawn with), pick a **set** (a pointer-table entry such as `transform_pose_00`), then step through its **frames** on the timeline. Every frame is a sprite **group**; select a **part** to see its fields, its tile on the GFX page and its palette row.

```
+--------------------+-----------------------------------------------+
| Gaia Spriter       | Bundle selector                               |
+--------------------+-----------------------------------------------+
| Set list           | Timeline: group label (parts) + thumbnail     |
+--------------------+---------------------------------+-------------+
| Parts list         |                                 | GFX page    |
+--------------------+  Group preview                  +-------------+
| Properties         |                                 | Palettes    |
+--------------------+---------------------------------+-------------+
```

## Quick start

```bash
npm install
npm run bundles     # one time: create data/spriteset-bundles.json from the baserom
npm run build       # payload.zip + dist/app.iife.js
npm run dev         # build, then serve this folder (open the printed URL)
```

The baserom is read from `GAIA_IOG_BASEROM` (default `../gaia-iog-baserom`). It needs `db-us/*.json` and an up to date `extracted/` folder (`npm run extract` in the baserom).

| Script | What it does |
|--------|--------------|
| `npm run bundles` | Generates / refreshes `data/spriteset-bundles.json` (see [docs/bundles.md](docs/bundles.md)). Not part of `build`, so hand edits survive. |
| `npm run payload` | Reads the bundles JSON and the baserom, writes `payload.zip` (see [docs/payload.md](docs/payload.md)). |
| `npm run build` | `payload`, then the `tsdown` bundle. |
| `npm run typecheck` | `tsc` for the app and for the scripts. |

## Using the viewer

- **Bundle selector** (banner): switches the collection and the art it is drawn with. `scenes:` next to it lists the scene ids that load this combination.
- **Set list**: `label (frames)`, frame count in hex. The collection prefix is dropped from labels (`spm_dao_sprites_sprite_set_00004E` shows as `sprite_set_00004E`); hover for the full label.
- **Timeline**: one cell per frame, `group label (parts)` (part count in hex) with a thumbnail. Click a cell to select it. **Play** steps through the set using `hold + 1` ticks at 60 Hz per frame.
- **Parts list**: raw asm operands `#size, #x, #x', #y, #y', #$tile`. Click a row, or click the part in the preview.
- **Properties**: decoded fields of the selected part plus the group header (extents, hit box, body box).
- **Preview**: wheel zooms in integer steps, drag pans, double-click re-frames. The view frames every frame of the set so playback does not jump.
- **GFX page**: page 1 / page 2 toggles; the page follows the selected part. The red box is the selected part's tile(s). Click a tile to mark it (white box).
- **Palettes**: click a row to recolor the GFX page. The preview always uses each part's own palette.

## Layout of this repo

```
data/spriteset-bundles.json      bundle list (generated, hand-editable, `locked` entries survive regeneration)
scripts/generate-bundles.ts      files.json / blocks.json / scene_meta  ->  bundles JSON
scripts/build-payload.ts         bundles JSON + extracted/  ->  payload.zip
scripts/lib/                     baserom access and the sprite asm / scene_meta parsers
src/shared/types.ts              data model shared by scripts and app
src/core/                        tile decoding, palettes, sprite rendering
src/data/                        payload fetch + IndexedDB cache, manifest, bundle loader
src/editor/                      the panes
src/ui/                          event bus, pannable canvas, layout helper
docs/                            architecture, bundle schema, payload format
```

Rendering details and the source data format are in [docs/architecture.md](docs/architecture.md).
