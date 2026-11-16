/**
 * #759 Part 1 implementation note (was #074 / #097): a tutor-intake profile
 * photo selected BEFORE the end-of-flow Google redirect would otherwise be
 * lost (Files do not survive JSON drafts). The blob is parked in IndexedDB
 * under `matchmax_pending_files_v1` for 10 minutes; after the OAuth callback
 * the form re-attaches it. If the round-trip exceeds 10 minutes (or the
 * browser blocked IndexedDB) the entry is gone and the optional upload is
 * simply re-done by hand — the submit never blocks on it.
 */

const DB_NAME = "matchmax_pending_files_v1";
const STORE_NAME = "files";
const FILE_TTL_MS = 10 * 60 * 1000;

type StoredFile = { file: File; at: number };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export async function stashPendingFile(key: string, file: File): Promise<void> {
  await withStore("readwrite", (store) => store.put({ file, at: Date.now() }, key));
}

export async function takePendingFile(key: string): Promise<File | null> {
  const stored = (await withStore("readonly", (store) => store.get(key))) as StoredFile | null;
  // Read and delete in one pass — the blob is single-use by design.
  void withStore("readwrite", (store) => store.delete(key));
  if (!stored) return null;
  if (Date.now() - stored.at >= FILE_TTL_MS) return null;
  return stored.file instanceof File ? stored.file : null;
}

export async function dropPendingFile(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}
