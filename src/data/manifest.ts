import { PAYLOAD_VERSION } from '../shared/types';
import type { PayloadManifest } from '../shared/types';

/** Parse and validate manifest.json from the unzipped payload. */
export function readManifest(files: Map<string, Uint8Array>): PayloadManifest {
  const raw = files.get('manifest.json');
  if (!raw) throw new Error('payload.zip has no manifest.json');
  const manifest = JSON.parse(new TextDecoder().decode(raw)) as PayloadManifest;
  if (manifest.version !== PAYLOAD_VERSION) {
    throw new Error(`Payload version ${manifest.version} does not match the app (${PAYLOAD_VERSION}); rebuild with "npm run payload"`);
  }
  if (!Array.isArray(manifest.bundles) || manifest.bundles.length === 0) throw new Error('Payload contains no bundles');
  return manifest;
}
