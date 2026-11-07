"use client";
import { createContext, useCallback, useContext, useState } from "react";
const ToastContext = createContext(() => {});
export function useToast() { return useContext(ToastContext); }
export default function ToastProvider({ children }) { const [items, setItems] = useState([]); const notify = useCallback((message, type = "success") => { const id = `${Date.now()}-${Math.random()}`; setItems(v => [...v, { id, message, type }]); setTimeout(() => setItems(v => v.filter(x => x.id !== id)), 4000); }, []); return <ToastContext.Provider value={notify}>{children}<div className="toast-stack" aria-live="polite">{items.map(x => <div key={x.id} className={`toast toast-${x.type}`}>{x.message}</div>)}</div></ToastContext.Provider>; }
