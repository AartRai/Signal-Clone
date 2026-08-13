"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

// The ToastProvider component manages global toast notifications for the application
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Adds a new toast to the queue and sets a timer to automatically remove it after 3 seconds
  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const contextValue: ToastContextType = {
    toast: addToast,
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 min-w-[300px] max-w-[400px] rounded-lg border border-border bg-surface-5 px-4 py-3 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-200"
          >
            {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
            {t.type === "error" && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
            {t.type === "info" && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
            <span className="text-sm font-medium text-foreground flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-secondary hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
