"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Toast = { id: number; title: string; description?: string; tone?: "success" | "info" };
type ToastContextValue = { showToast: (toast: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now();
    setToasts((items) => [...items.slice(-2), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-region" aria-live="polite" aria-label="الإشعارات">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : Info;
          return (
            <div className="ui-toast" key={toast.id} role="status">
              <Icon aria-hidden="true" size={21} />
              <div><strong>{toast.title}</strong>{toast.description ? <p>{toast.description}</p> : null}</div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="إغلاق الإشعار">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
