"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { listOfflineMutations, removeOfflineMutation, updateOfflineMutation } from "./queue";

type OfflineState = { pending: number; syncing: boolean; retry: () => Promise<void> };
const Context = createContext<OfflineState>({ pending: 0, syncing: false, retry: async () => undefined });

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0); const [syncing, setSyncing] = useState(false); const [updateAvailable, setUpdateAvailable] = useState(false);
  const sync = useCallback(async () => {
    const queued = await listOfflineMutations().catch(() => []); setPending(queued.length);
    if (!navigator.onLine || queued.length === 0 || syncing) return;
    setSyncing(true);
    try {
      for (const item of queued) {
        if (item.state === "conflict" || (item.nextRetryAt && Date.parse(item.nextRetryAt) > Date.now())) continue;
        await updateOfflineMutation({ ...item, state: "syncing" });
        try {
        const response = await fetch("/api/offline/sync", { method: "POST", headers: { "content-type": "application/json", "x-mawahib-offline": "1" }, body: JSON.stringify(item) });
        if (response.ok) await removeOfflineMutation(item.id);
        else if (response.status === 409) await updateOfflineMutation({ ...item, state: "conflict", attempts: (item.attempts ?? 0) + 1, lastError: "conflict" });
        else await markRetry(item, response.status >= 400 && response.status < 500 && response.status !== 429 ? "failed" : "pending", `HTTP ${response.status}`);
        } catch { await markRetry(item, "pending", "network"); }
      }
    } finally {
      setPending((await listOfflineMutations().catch(() => [])).length); setSyncing(false);
    }
  }, [syncing]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) setUpdateAvailable(true);
      registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
      }));
    });
    const listener = () => void sync(); window.addEventListener("online", listener); window.addEventListener("mawahib:offline-queue", listener);
    const initial = window.setTimeout(listener, 0); const timer = window.setInterval(listener, 30000);
    return () => { window.removeEventListener("online", listener); window.removeEventListener("mawahib:offline-queue", listener); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [sync]);

  const activateUpdate = () => navigator.serviceWorker.getRegistration().then((registration) => {
    if (!registration?.waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  });
  return <Context.Provider value={{ pending, syncing, retry: sync }}>{children}{pending > 0 ? <button className="offline-status" type="button" onClick={() => void sync()} aria-label="إعادة محاولة المزامنة">{syncing ? <RefreshCw className="ui-spin" size={16} /> : <CloudOff size={16} />}<span>{pending} غير متزامن</span></button> : null}{updateAvailable ? <button className="app-update-status" type="button" onClick={() => void activateUpdate()}>نسخة جديدة متاحة · تحديث</button> : null}</Context.Provider>;
}

export function useOfflineState(): OfflineState { return useContext(Context); }

async function markRetry(item: Awaited<ReturnType<typeof listOfflineMutations>>[number], state: "pending" | "failed", lastError: string) {
  const attempts = (item.attempts ?? 0) + 1;
  const delay = Math.min(300_000, 2 ** Math.min(attempts, 8) * 1000);
  await updateOfflineMutation({ ...item, state, attempts, lastError, nextRetryAt: new Date(Date.now() + delay).toISOString() });
}
