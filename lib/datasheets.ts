const DB_NAME = "genera-os-datasheets";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDatasheetFile(itemId: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(
      { name: file.name, type: file.type, blob: file, at: new Date().toISOString() },
      itemId
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDatasheetFile(
  itemId: string
): Promise<{ name: string; url: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(itemId);
    req.onsuccess = () => {
      const row = req.result as { name: string; type: string; blob: Blob } | undefined;
      if (!row?.blob) {
        resolve(null);
        return;
      }
      resolve({ name: row.name, url: URL.createObjectURL(row.blob) });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDatasheetFile(itemId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(itemId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
