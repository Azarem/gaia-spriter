import { unzipSync } from 'fflate';

const DB_NAME = 'gaia-spriter-cache';
const STORE_NAME = 'payloads';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function putCached(key: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // A failed cache write is not fatal.
  }
}

/** Remove every cached payload except `keepKey` (older payload versions). */
async function pruneCache(keepKey: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        for (const key of req.result) if (key !== keepKey) store.delete(key);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Pruning failure is not fatal.
  }
}

/**
 * Download the payload ZIP (cached in IndexedDB) and unzip it into a map of zip path -> bytes.
 * `version` is part of the cache key: bump PAYLOAD_VERSION whenever the payload format changes.
 */
export async function fetchPayload(url: string, version: number): Promise<Map<string, Uint8Array>> {
  const cacheKey = `${url}?v=${version}`;
  let buffer = await getCached(cacheKey);
  if (!buffer) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Failed to fetch payload: ${response.status} ${response.statusText}`);
    buffer = await response.arrayBuffer();
    await putCached(cacheKey, buffer);
    await pruneCache(cacheKey);
  }
  return new Map(Object.entries(unzipSync(new Uint8Array(buffer))));
}

/** Drop every cached payload (debugging). */
export async function clearCache(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
