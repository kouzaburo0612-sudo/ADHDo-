"use client";

// 写真ドラフトの保存(要件C-2: ファイル本体は IndexedDB に保存して復元)

export type StoredImage = { name: string; mediaType: string; base64: string };

const DB_NAME = "alfy-drafts";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImages(key: string, images: StoredImage[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(images, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB 不可の環境では保存を諦める(画面上の入力は維持される)
  }
}

export async function loadImages(key: string): Promise<StoredImage[]> {
  try {
    const db = await openDb();
    const images = await new Promise<StoredImage[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as StoredImage[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return images;
  } catch {
    return [];
  }
}

export async function clearImages(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* noop */
  }
}
