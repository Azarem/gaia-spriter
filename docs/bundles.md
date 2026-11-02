# Spriteset bundles

`data/spriteset-bundles.json` is the single input of the payload build. `npm run bundles` creates it; afterwards it can be edited by hand.

## Concept

A sprite collection (one pointer table of sets) is drawn from sprite VRAM, which has two 128x128 pages (256 tiles of 32 bytes, 8192 bytes each; the OAM name-table bit selects the page) and eight 16-colour sprite palettes (CGRAM `$80`-`$FF`). A **bundle** fixes which graphics and palettes a collection is shown with.

## Schema

```jsonc
{
  "game": "illusion-of-gaia",
  "defaults": {
    "page1": { "file": "gfx_000000", "srcOffset": 0, "length": 8192, "dstOffset": 0 },
    "palette": "fx_palette_198020"        // 16 colours, fills every sprite palette a bundle does not write
  },
  "bundles": [
    {
      "id": "spm_southcape_sprites",       // unique; variants get "#2", "#3"
      "label": "spm_southcape_sprites",    // shown in the selector
      "collection": "spm_southcape_sprites", // Spritemap file name or &sprite-set block name
      "source": "spritemap",               // "spritemap" (files.json) | "sprite-set" (blocks.json)
      "scenes": [1, 3, 4],                 // scene ids whose scene_meta record loads this combination
      "locked": true,                      // optional: generator keeps the entry as is
      "page1": { "file": "gfx_000000", "srcOffset": 0, "length": 8192, "dstOffset": 0 },
      "page2": { "file": "gfx_southcape_sprites", "srcOffset": 0, "length": 8192, "dstOffset": 0 },
      "palettes": [
        { "file": "pal_southcape_sprites", "srcColor": 32, "count": 96, "dstColor": 32 }
      ]
    }
  ]
}
```

- **Page source** (`page1`, `page2`): copy `length` bytes from decompressed file `file` (a files.json name, extracted as `.bin` / `.raw.bin`) at `srcOffset` to byte `dstOffset` of the page. The rest of the page is zero. `page2` may be `null` (empty page).
- **Palette source**: copy `count` colours (2 bytes each) starting at colour `srcColor` of the palette file to colour `dstColor` (0-127, CGRAM colour minus 128) of the sprite palettes. Runs apply in order, later ones win.

## How `npm run bundles` fills it in

1. Lists the 45 `Spritemap` entries of `db-us/files.json` and the 17 `&sprite-set` blocks of `db-us/blocks.json`.
2. Parses `extracted/tables/scene_meta.asm` and walks every record along every execution path: `jump < #NN >` continues at label `NN` (maybe inside another record, running to that record's end) and `branch < #flag, #NN >` is followed both ways.
3. At each `spritemap < size, 0, @spm_x >` command it takes the state loaded so far:
   - `bitmap < start, end, dst, @gfx, #01 >` (mode 1 = sprite VRAM): `srcOffset = start * $200`, `length = (end - start) * $200`, absolute sprite VRAM offset `dst * $200`; offsets from `$2000` on land in page 2, the rest in page 1.
   - `palette < start, end, dst, @pal >` with `dst >= $80`: `srcColor = start`, `count = end - start`, `dstColor = dst - $80`.
4. Creates one bundle per distinct combination for each spritemap (`id`, `id#2`, ...), with the scene ids that use it. A spritemap that no scene loads keeps only the defaults.
5. `&sprite-set` tables (player, props, effects) are not loaded by a scene; they get the defaults. Edit them by hand (the player art files are 16384 bytes, two pages).
6. Merges with the existing file: entries with `"locked": true` are kept verbatim (and any locked entry that is no longer generated is kept too). Everything else is replaced. Mark an entry `locked` as soon as you edit it.

Warnings are printed when a page is loaded more than once on a path (the last load wins) or a range does not fit.
