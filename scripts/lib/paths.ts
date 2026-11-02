import * as path from 'node:path';

/** Repository root of gaia-spriter. */
export const SPRITER_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** data/spriteset-bundles.json */
export const BUNDLES_PATH = path.join(SPRITER_ROOT, 'data', 'spriteset-bundles.json');

/** Baserom location: GAIA_IOG_BASEROM or the sibling checkout. */
export function baseromRoot(): string {
  return process.env.GAIA_IOG_BASEROM
    ? path.resolve(process.env.GAIA_IOG_BASEROM)
    : path.resolve(SPRITER_ROOT, '..', 'gaia-iog-baserom');
}
