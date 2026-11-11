"use client";
import { AlertTriangle, X } from "lucide-react";
export default function ConfirmModal({ open, title = "Confirm action", message = "Are you sure?", confirmText = "Confirm", busy = false, onCancel, onConfirm, danger = true }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}><section className="card confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"><div className="confirm-icon"><AlertTriangle size={24}/></div><button className="icon-button confirm-close" type="button" onClick={onCancel} disabled={busy} aria-label="Close"><X size={18}/></button><h2 id="confirm-modal-title" className="section-heading">{title}</h2><p className="muted">{message}</p><div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? "Please wait..." : confirmText}</button></div></section></div>;
}
