"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { INDIAN_STATES, getIndianStateCode } from "@/lib/indian-states";

const emptySupplier = { supplier_code: "", supplier_name: "", contact_person: "", address: "", city: "", state: "", pincode: "", country: "India", gstin: "", mobile: "", email: "", remarks: "" };
const fields = [
  ["supplier_code", "Supplier Code", "text"], ["supplier_name", "Supplier Name *", "text"],
  ["contact_person", "Contact Person", "text"], ["address", "Address *", "text"],
  ["city", "City", "text"], ["pincode", "PIN Code", "text"],
  ["country", "Country", "text"], ["gstin", "GSTIN", "text"], ["mobile", "Mobile *", "tel"],
  ["email", "Email", "email"], ["remarks", "Remarks", "text"]
];

/** Reusable supplier form for the Suppliers page and other modules, including ItemMaster. */
export default function SupplierModal({ isOpen, supplier = null, onClose, onSaved }) {
  const [form, setForm] = useState(emptySupplier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      const initial = supplier ? Object.fromEntries(Object.keys(emptySupplier).map((key) => [key, supplier[key] ?? ""])) : { ...emptySupplier };
      initial.state = getIndianStateCode(initial.state);
      setForm(initial); setError("");
    }
  }, [isOpen, supplier]);
  if (!isOpen) return null;
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/suppliers", { method: supplier ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(supplier ? { id: supplier.id } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save supplier.");
      onSaved?.(data.supplier); onClose();
    } catch (err) { setError(err.message || "Unable to save supplier."); }
    finally { setSaving(false); }
  }
  return createPortal(<div className="modal-backdrop nested-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card item-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title">
      <div className="modal-heading"><div><h2 id="supplier-modal-title" className="section-heading">{supplier ? "Edit Supplier" : "Add Supplier"}</h2><p className="muted">Fields marked * are required.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close modal"><X size={18} /></button></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit}><div className="form-grid item-form-grid">
        {fields.map(([name, label, type]) => <div className="field" key={name}><label htmlFor={`supplier-${name}`}>{label}</label><input id={`supplier-${name}`} name={name} type={type} value={form[name]} onChange={update} readOnly={name === "supplier_code"} required={["supplier_name", "address", "mobile"].includes(name)} maxLength={name === "remarks" ? 1000 : 500} /></div>)}
        <div className="field"><label htmlFor="supplier-state">State *</label><select id="supplier-state" name="state" value={form.state} onChange={update} required><option value="">-Select-</option>{INDIAN_STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></div>
      </div><div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : supplier ? "Save Changes" : "Save Supplier"}</button></div></form>
    </section>
  </div>, document.body);
}
