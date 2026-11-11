"use client";

import { useEffect, useState } from "react";
import { X, Save, Plus, Search } from "lucide-react";
import SupplierModal from "@/app/components/suppliers/SupplierModal";

const emptyItem = {
  item_code: "", part_number: "", model_number: "", description: "", qty: "0",
  supplier_id: "", supplier_name: "", purchase_price: "0", selling_price: "0", gst: "0", hsn_code: ""
};

const fields = [
  { name: "item_code", label: "Item Code *", required: true },
  { name: "part_number", label: "Part Number" },
  { name: "model_number", label: "Model Number" },
  { name: "description", label: "Description *", required: true, wide: true },
  { name: "qty", label: "Quantity *", type: "number", required: true, min: "0" },
  { name: "purchase_price", label: "Purchase Price *", type: "number", required: true, min: "0", step: "0.01" },
  { name: "selling_price", label: "Selling Price *", type: "number", required: true, min: "0", step: "0.01" },
  { name: "gst", label: "GST % *", type: "number", required: true, min: "0", max: "100", step: "0.01" },
  { name: "hsn_code", label: "HSN Code" }
];

/** Reusable ItemMaster modal. Other pages can open it and receive the saved item in onSaved. */
export default function ItemMasterModal({ isOpen, item = null, onClose, onSaved, onSelect, selectionMode = false }) {
  const [form, setForm] = useState(emptyItem);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [showForm, setShowForm] = useState(!selectionMode);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowForm(!selectionMode || Boolean(item));
      setItemSearch("");
      // Convert numeric values to strings for controlled HTML form inputs.
      setForm(item ? Object.fromEntries(Object.keys(emptyItem).map((key) => [key, String(item[key] ?? "")])) : emptyItem);
      setSupplierQuery(item?.supplier_name || "");
      setSupplierMenuOpen(false);
      setError("");
    }
    if (isOpen) {
      fetch("/api/suppliers", { cache: "no-store" }).then((response) => response.json()).then((data) => {
        const list = Array.isArray(data.suppliers) ? data.suppliers : [];
        setSuppliers(list);
        if (item?.supplier_id) {
          const selected = list.find((entry) => entry.id === item.supplier_id);
          if (selected) setSupplierQuery(selected.supplier_name);
        }
      }).catch(() => setSuppliers([]));
    }
    if (isOpen && selectionMode) {
      // Selection mode lets Purchase/Sales pick an existing item from the same company.
      fetch("/api/item-master", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => { if (Array.isArray(data.items)) setAvailableItems(data.items); })
        .catch(() => setAvailableItems([]));
    }
  }, [isOpen, item, selectionMode]);

  if (!isOpen) return null;

  function change(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  function selectSupplier(supplier) {
    setForm((previous) => ({ ...previous, supplier_id: supplier.id, supplier_name: supplier.supplier_name }));
    setSupplierQuery(supplier.supplier_name);
    setSupplierMenuOpen(false);
  }

  function supplierSaved(supplier) {
    setSuppliers((previous) => {
      const exists = previous.some((entry) => entry.id === supplier.id);
      return (exists ? previous.map((entry) => entry.id === supplier.id ? supplier : entry) : [...previous, supplier]).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
    });
    selectSupplier(supplier);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [
        key, ["qty", "purchase_price", "selling_price", "gst"].includes(key) ? Number(value) : value
      ]));
      const response = await fetch("/api/item-master", {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item ? { ...payload, id: item.id } : payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save item.");
      onSaved?.(data.item);
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Unable to save item.");
    } finally {
      setBusy(false);
    }
  }

  const matchingItems = availableItems.filter((entry) =>
    [entry.item_code, entry.part_number, entry.model_number, entry.description, entry.supplier_name]
      .some((value) => String(value || "").toLowerCase().includes(itemSearch.toLowerCase()))
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="item-modal card" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
        <div className="modal-heading">
          <div>
            <h2 id="item-modal-title" className="section-heading">{selectionMode && !showForm ? "Select an Item" : item ? "Edit Item" : "Add Item"}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Fields marked * are required.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {selectionMode && !showForm ? (
          <div className="item-picker">
            <div className="field"><label htmlFor="item-picker-search">Search items</label><input id="item-picker-search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search item code or description" /></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Selling Price</th><th /></tr></thead><tbody>
              {matchingItems.map((entry) => <tr key={entry.id}><td>{entry.item_code}</td><td>{entry.description}</td><td>{entry.qty}</td><td>{Number(entry.selling_price || 0).toFixed(2)}</td><td><button className="btn btn-primary" type="button" onClick={() => { onSelect?.(entry); onClose(); }}>Select</button></td></tr>)}
              {!matchingItems.length && <tr><td colSpan={5}>No matching items found.</td></tr>}
            </tbody></table></div>
            <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="button" onClick={() => { setForm(emptyItem); setShowForm(true); }}>Create New Item</button></div>
          </div>
        ) : <form onSubmit={save}>
          <div className="form-grid item-form-grid">
            {fields.map((field) => (
              <div className="field" key={field.name} style={field.wide ? { gridColumn: "1 / -1" } : undefined}>
                <label htmlFor={`item-${field.name}`}>{field.label}</label>
                <input
                  id={`item-${field.name}`} name={field.name} type={field.type || "text"}
                  value={form[field.name]} onChange={change} required={field.required}
                  min={field.min} max={field.max} step={field.step}
                  maxLength={field.type ? undefined : field.name === "description" ? 500 : 200}
                />
              </div>
            ))}
            <div className="field" style={{ gridColumn: "1 / -1", position: "relative" }}>
              <label htmlFor="item-supplier-search">Supplier</label>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: 10, top: 13, color: "#667085" }} />
                  <input id="item-supplier-search" value={supplierQuery} autoComplete="off" placeholder="Search supplier by name, GSTIN or mobile..." style={{ paddingLeft: 34 }}
                    onFocus={() => setSupplierMenuOpen(true)}
                    onChange={(event) => { setSupplierQuery(event.target.value); setSupplierMenuOpen(true); setForm((previous) => ({ ...previous, supplier_id: "", supplier_name: event.target.value })); }} />
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setSupplierModalOpen(true)}><Plus size={16} /> Add Supplier</button>
              </div>
              {supplierMenuOpen && <div className="supplier-autocomplete-list" role="listbox" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "white", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,.15)" }}>
                {suppliers.filter((supplier) => [supplier.supplier_name, supplier.gstin, supplier.mobile].some((value) => String(value || "").toLowerCase().includes(supplierQuery.trim().toLowerCase()))).slice(0, 30).map((supplier) => <button key={supplier.id} type="button" role="option" aria-selected={form.supplier_id === supplier.id} onClick={() => selectSupplier(supplier)} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 12px", border: 0, borderBottom: "1px solid #eaecf0", background: form.supplier_id === supplier.id ? "#f0fdf4" : "white", cursor: "pointer", textAlign: "left" }}><strong>{supplier.supplier_name}</strong><span className="muted" style={{ fontSize: 12 }}>GSTIN: {supplier.gstin || "—"} · Mobile: {supplier.mobile || "—"}</span></button>)}
                {!suppliers.some((supplier) => [supplier.supplier_name, supplier.gstin, supplier.mobile].some((value) => String(value || "").toLowerCase().includes(supplierQuery.trim().toLowerCase()))) && <div className="muted" style={{ padding: 12, fontSize: 13 }}>No matching suppliers. Use Add Supplier to create one.</div>}
                <button type="button" className="btn btn-secondary" style={{ margin: 8 }} onClick={() => setSupplierMenuOpen(false)}>Close list</button>
              </div>}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy}><Save size={16} />{busy ? "Saving..." : item ? "Save Changes" : "Save Item"}</button>
          </div>
        </form>}
      </section>
      <SupplierModal isOpen={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSaved={supplierSaved} />
    </div>
  );
}
