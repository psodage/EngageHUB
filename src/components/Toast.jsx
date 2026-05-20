import { useEffect } from "react";
import { useApp } from "../context/AppContext";

export default function Toast() {
  const { toast, setToast } = useApp();

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.error ? 4200 : 3400);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-lg px-4 py-3 text-center text-sm font-semibold shadow-lg ${
        toast.error ? "bg-red-700 text-white" : "bg-slate-900 text-white dark:bg-slate-800"
      }`}
    >
      {toast.message}
    </div>
  );
}
