export type OfflineMutation = {
  id: string;
  kind: "message.send" | "request.create" | "quran.practice" | "assignment.update";
  payload: Record<string, unknown>;
  attempts?: number;
  createdAt?: string;
  lastError?: string;
};

const databaseName = "mawahib-v3-offline";
const storeName = "sync-queue";

export async function enqueueOfflineMutation(item: OfflineMutation): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) => store.put({ ...item, attempts: item.attempts ?? 0, createdAt: item.createdAt ?? new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("mawahib:offline-queue"));
}

export async function listOfflineMutations(): Promise<OfflineMutation[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as OfflineMutation[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineMutation(id: string): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) => store.delete(id));
}

export async function updateOfflineMutation(item: OfflineMutation): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) => store.put(item));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb_unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionPromise(database: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
