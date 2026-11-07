"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { INDIAN_STATES, getIndianStateCode } from "@/lib/indian-states";

const emptyCustomer = { customer_code: "", customer_name: "", contact_person: "", address: "", city: "", state: "", place_of_supply: "", pincode: "", country: "India", gstin: "", mobile: "", email: "", remarks: "" };
const fields = [
  ["customer_code", "Customer Code", "text"], ["customer_name", "Customer Name *", "text"],
  ["contact_person", "Contact Person", "text"], ["address", "Address *", "text"],
  ["city", "City", "text"], ["pincode", "PIN Code", "text"],
  ["country", "Country", "text"], ["gstin", "GSTIN", "text"], ["mobile", "Mobile *", "tel"],
  ["email", "Email", "email"], ["remarks", "Remarks", "text"]
];

// Reusable modal: it can be mounted by Customer, Sales, or other pages.
export default function CustomerModal({ isOpen, customer = null, companyState = "", onClose, onSaved }) {
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [placeMode, setPlaceMode] = useState("company");
  const [error, setError] = useState("");
  useEffect(() => { if (isOpen) { const initial = customer ? Object.fromEntries(Object.keys(emptyCustomer).map((key) => [key, customer[key] ?? ""])) : { ...emptyCustomer, place_of_supply: companyState }; initial.state = getIndianStateCode(initial.state); initial.place_of_supply = getIndianStateCode(initial.place_of_supply) || companyState || ""; setForm(initial); setPlaceMode(!initial.place_of_supply || initial.place_of_supply === companyState ? "company" : "other"); setError(""); } }, [isOpen, customer, companyState]);
  if (!isOpen) return null;
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: customer ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(customer ? { id: customer.id } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save customer.");
      onSaved(data.customer); onClose();
    } catch (err) { setError(err.message || "Unable to save customer."); }
    finally { setSaving(false); }
  }
  return createPortal(<div className="modal-backdrop nested-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card item-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
      <div className="modal-heading"><div><h2 id="customer-modal-title" className="section-heading">{customer ? "Edit Customer" : "Add Customer"}</h2><p className="muted">Fields marked * are required.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close modal"><X size={18} /></button></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid item-form-grid">{fields.map(([name, label, type]) => <div className="field" key={name}><label htmlFor={`customer-${name}`}>{label}</label><input id={`customer-${name}`} name={name} type={type} value={form[name]} onChange={update} required={["customer_name", "address", "mobile"].includes(name)} maxLength={name === "remarks" ? 1000 : 500} /></div>)}
          <div className="field"><label htmlFor="customer-state">State *</label><select id="customer-state" name="state" value={form.state} onChange={update} required><option value="">-Select-</option>{INDIAN_STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></div>
          <div className="field"><label htmlFor="customer-place-of-supply">Place of Supply</label><select id="customer-place-of-supply" value={placeMode} onChange={(event) => { const mode = event.target.value; setPlaceMode(mode); setForm((current) => ({ ...current, place_of_supply: mode === "company" ? companyState : (current.place_of_supply === companyState ? "" : current.place_of_supply) })); }}><option value="">-Select-</option><option value="company" disabled={!companyState}>Company&apos;s State ({INDIAN_STATES.find((state) => state.value === companyState)?.label || "not set in Company Profile"})</option><option value="other">Other State / UT</option></select>{placeMode === "other" && <div style={{ marginTop: 8 }}><label htmlFor="customer-place-of-supply-state">Select Place of Supply State / UT</label><select id="customer-place-of-supply-state" name="place_of_supply" value={form.place_of_supply} onChange={update} required={placeMode === "other"}><option value="">-Select-</option>{INDIAN_STATES.filter((state) => state.value !== companyState).map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></div>}<small>Defaults to the company&apos;s registered state. Select Other State / UT and specify the applicable state when needed.</small></div>
        </div>
        <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : customer ? "Save Changes" : "Save Customer"}</button></div>
      </form>
    </section>
  </div>, document.body);
}
