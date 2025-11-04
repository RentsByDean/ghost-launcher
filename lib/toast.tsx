"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };
type ToastContextValue = { show: (message: string, type?: Toast['type']) => void };

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] space-y-2" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded border px-3 py-2 text-sm shadow ${t.type === 'error' ? 'border-red-800 bg-red-950 text-red-100' : t.type === 'success' ? 'border-green-800 bg-green-950 text-green-100' : 'border-zinc-700 bg-zinc-900 text-zinc-100'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}


