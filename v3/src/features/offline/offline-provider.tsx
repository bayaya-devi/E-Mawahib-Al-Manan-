"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { listOfflineMutations, removeOfflineMutation, updateOfflineMutation } from "./queue";

type OfflineState = { pending: number; syncing: boolean; retry: () => Promise<void> };
const Context = createContext<OfflineState>({ pending: 0, syncing: false, retry: async () => undefined });

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0); const [syncing, setSyncing] = useState(false);
  const sync = useCallback(async () => {
    const queued = await listOfflineMutations().catch(() => []); setPending(queued.length);
    if (!navigator.onLine || queued.length === 0 || syncing) return;
    setSyncing(true);
    for (const item of queued) {
      try {
        const response = await fetch("/api/offline/sync", { method: "POST", headers: { "content-type": "application/json", "x-mawahib-offline": "1" }, body: JSON.stringify(item) });
        if (response.ok) await removeOfflineMutation(item.id);
        else if (response.status === 409) await updateOfflineMutation({ ...item, attempts: (item.attempts ?? 0) + 1, lastError: "conflict" });
        else if (response.status >= 400 && response.status < 500 && response.status !== 429) await removeOfflineMutation(item.id);
        else await updateOfflineMutation({ ...item, attempts: (item.attempts ?? 0) + 1, lastError: `HTTP ${response.status}` });
      } catch { await updateOfflineMutation({ ...item, attempts: (item.attempts ?? 0) + 1, lastError: "network" }); }
    }
    setPending((await listOfflineMutations().catch(() => [])).length); setSyncing(false);
  }, [syncing]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const listener = () => void sync(); window.addEventListener("online", listener); window.addEventListener("mawahib:offline-queue", listener);
    const initial = window.setTimeout(listener, 0); const timer = window.setInterval(listener, 30000);
    return () => { window.removeEventListener("online", listener); window.removeEventListener("mawahib:offline-queue", listener); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [sync]);

  return <Context.Provider value={{ pending, syncing, retry: sync }}>{children}{pending > 0 ? <button className="offline-status" type="button" onClick={() => void sync()} aria-label="إعادة محاولة المزامنة">{syncing ? <RefreshCw className="ui-spin" size={16} /> : <CloudOff size={16} />}<span>{pending} غير متزامن</span></button> : null}</Context.Provider>;
}

export function useOfflineState(): OfflineState { return useContext(Context); }
