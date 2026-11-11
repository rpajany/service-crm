"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, Pencil, Trash2, X, Package, Users, RefreshCw } from "lucide-react";
import ConfirmModal from "@/app/components/common/ConfirmModal";

function monthRange() {
  const now = new Date(); const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function dateInput(value) { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function displayDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB"); }
function exportCsv(rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headers = ["RMI No", "RMI Date", "Engineer", "Item Code", "Description", "Part Number", "Model Number", "RMI Qty"];
  const data = rows.map((r) => [r.rmi_no, displayDate(r.rmi_date), r.eng_name, r.item_code, r.description, r.part_number, r.model_number, r.rmi_qty]);
  const blob = new Blob(["\uFEFF", [headers, ...data].map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `rmi-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function RMIPage() {
  const initial = useMemo(monthRange, []);
  const [records, setRecords] = useState([]); const [engineers, setEngineers] = useState([]);
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to); const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false); const [editingId, setEditingId] = useState(""); const [saving, setSaving] = useState(false);
  const [engineerSearch, setEngineerSearch] = useState(""); const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [itemSearch, setItemSearch] = useState(""); const [items, setItems] = useState([]); const [selectedItem, setSelectedItem] = useState(null); const [itemsLoading, setItemsLoading] = useState(false);
  const [rmiNo, setRmiNo] = useState(""); const [rmiQty, setRmiQty] = useState("1"); const [rmiDate, setRmiDate] = useState(() => dateInput(new Date()));
  const [deleteTarget, setDeleteTarget] = useState(null); const [deleting, setDeleting] = useState(false);

  const loadEngineers = useCallback(async () => {
    const response = await fetch("/api/rmi-consumption?view=lookups", { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load engineers."); setEngineers(data.engineers || []);
  }, []);
  const loadRecords = useCallback(async () => {
    setLoading(true); setError("");
    try { const params = new URLSearchParams({ from, to, search }); const response = await fetch(`/api/rmi-consumption?${params}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load RMI records."); setRecords(data.records || []); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [from, to, search]);
  useEffect(() => { loadEngineers().catch((e) => setError(e.message)); }, [loadEngineers]);
  useEffect(() => { const timer = setTimeout(loadRecords, 250); return () => clearTimeout(timer); }, [loadRecords]);

  const matchingEngineers = useMemo(() => { const term = engineerSearch.toLowerCase().trim(); return engineers.filter((e) => !term || e.username.toLowerCase().includes(term) || e.fullName.toLowerCase().includes(term)).slice(0, 12); }, [engineers, engineerSearch]);
  const matchingItems = useMemo(() => { const term = itemSearch.toLowerCase().trim(); return items.filter((i) => !term || [i.item_code, i.description, i.part_number, i.model_number].some((v) => String(v || "").toLowerCase().includes(term))).slice(0, 15); }, [items, itemSearch]);

  async function loadEngineerItems(engineerId) {
    setItemsLoading(true); setItems([]); setSelectedItem(null);
    try { const response = await fetch(`/api/rmi-consumption?view=items&engineer_id=${encodeURIComponent(engineerId)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load engineer stock."); setItems(data.items || []); }
    catch (e) { setError(e.message); } finally { setItemsLoading(false); }
  }
  function resetForm() { setEditingId(""); setSelectedEngineer(null); setEngineerSearch(""); setItems([]); setSelectedItem(null); setItemSearch(""); setRmiNo(""); setRmiQty("1"); setRmiDate(dateInput(new Date())); }
  function openCreate() { resetForm(); setError(""); setModalOpen(true); }
  async function openEdit(row) {
    resetForm(); setError(""); setEditingId(row.id); setRmiNo(row.rmi_no); setRmiQty(String(row.rmi_qty)); setRmiDate(dateInput(row.rmi_date));
    const engineer = engineers.find((e) => e.id === row.engineer_id) || { id: row.engineer_id, username: row.eng_name, fullName: row.eng_name };
    setSelectedEngineer(engineer); setEngineerSearch(`${engineer.username} (${engineer.fullName})`); setModalOpen(true);
    await loadEngineerItems(engineer.id);
    // The edited transaction's current item may have zero balance after its own consumption.
    // Add it to the choices so the user can save an unchanged record or adjust it safely.
    setSelectedItem({ id: row.item_id, item_code: row.item_code, description: row.description, part_number: row.part_number, model_number: row.model_number, available_qty: Number(row.rmi_qty) });
  }
  async function saveRmi(event) {
    event.preventDefault(); setError(""); setNotice("");
    if (!selectedEngineer || !selectedItem) { setError("Select an engineer and an item."); return; }
    if (!(Number(rmiQty) > 0) || !Number.isFinite(Number(rmiQty))) { setError("Enter an RMI Qty greater than zero."); return; }
    setSaving(true);
    try {
      const payload = { engineer_id: selectedEngineer.id, item_id: selectedItem.id, rmi_no: rmiNo, rmi_qty: rmiQty, rmi_date: rmiDate };
      const response = await fetch("/api/rmi-consumption", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save RMI.");
      setNotice(data.message || "RMI saved successfully."); setModalOpen(false); resetForm(); await loadRecords();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function deleteRmi() {
    if (!deleteTarget) return; setDeleting(true);
    try { const response = await fetch(`/api/rmi-consumption?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to delete RMI."); setNotice(data.message); setDeleteTarget(null); await loadRecords(); }
    catch (e) { setError(e.message); } finally { setDeleting(false); }
  }

  return <main className="content">
    <div className="page-heading-row"><div><h1 className="page-title">RMI</h1><p className="muted" style={{ marginTop: 8 }}>Record engineer material consumption and track available engineer stock.</p></div><button className="btn btn-primary" type="button" onClick={openCreate}><Plus size={17}/> Create RMI</button></div>
    {error && !modalOpen && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <section className="card item-table-card">
      <div className="form-grid rmi-filters"><div className="field"><label htmlFor="rmi-from">From Date</label><input id="rmi-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}/></div><div className="field"><label htmlFor="rmi-to">To Date</label><input id="rmi-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}/></div><div className="field"><label htmlFor="rmi-search">Search</label><div className="search-box"><Search size={18}/><input id="rmi-search" placeholder="RMI No, engineer, item code or description..." value={search} onChange={(e) => setSearch(e.target.value)}/></div></div></div>
      <div className="table-toolbar"><span className="muted">RMI Consumption Records</span><div className="toolbar-actions"><button className="btn btn-secondary" type="button" onClick={loadRecords} disabled={loading}><RefreshCw size={16}/> Refresh</button><button className="btn rmi-export-btn" type="button" onClick={() => exportCsv(records)} disabled={!records.length || loading}><Download size={16}/> Export Excel</button></div></div>
      {loading ? <div className="empty-state">Loading RMI records...</div> : records.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>RMI Date</th><th>RMI No</th><th>Engineer</th><th>Item Code</th><th>Description</th><th>Part Number</th><th>Model Number</th><th>RMI Qty</th><th>Actions</th></tr></thead><tbody>{records.map((row) => <tr key={row.id}><td>{displayDate(row.rmi_date)}</td><td>{row.rmi_no}</td><td>{row.eng_name}</td><td>{row.item_code}</td><td>{row.description}</td><td>{row.part_number || "—"}</td><td>{row.model_number || "—"}</td><td>{Number(row.rmi_qty).toLocaleString()}</td><td><div className="table-actions"><button className="icon-button" type="button" title="Edit" onClick={() => openEdit(row)}><Pencil size={16}/></button><button className="icon-button danger" type="button" title="Delete" onClick={() => setDeleteTarget(row)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><Package size={28}/><strong>No RMI records found</strong><span>Create an RMI to record material consumed by an engineer.</span></div>}
      <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Dates are displayed as dd/MM/yyyy. Up to 5,000 matching records are loaded.</p>
    </section>

    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><section className="card rmi-modal" role="dialog" aria-modal="true" aria-labelledby="rmi-modal-title"><div className="rmi-modal-header"><div><h2 id="rmi-modal-title" className="section-heading">RMI Consumption</h2><p className="muted">Select an engineer and consume available stock.</p></div><button className="icon-button" type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close"><X size={19}/></button></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={saveRmi} className="rmi-form">
        <div className="field rmi-suggest-field"><label htmlFor="rmi-engineer">Eng Name</label><div className="search-box"><Users size={18}/><input id="rmi-engineer" autoComplete="off" placeholder="Search engineer username..." value={engineerSearch} onChange={(e) => { setEngineerSearch(e.target.value); setSelectedEngineer(null); setItems([]); setSelectedItem(null); }} required={!selectedEngineer}/></div>{!selectedEngineer && engineerSearch && <div className="rmi-suggestions">{matchingEngineers.map((eng) => <button type="button" key={eng.id} onClick={() => { setSelectedEngineer(eng); setEngineerSearch(`${eng.username} (${eng.fullName})`); setItemSearch(""); loadEngineerItems(eng.id); }}>{eng.username}<span>{eng.fullName}</span></button>)}{!matchingEngineers.length && <div className="rmi-no-match">No active engineer found.</div>}</div>}</div>
        <div className="field rmi-suggest-field"><label htmlFor="rmi-item">Search Item</label><div className="search-box"><Search size={18}/><input id="rmi-item" autoComplete="off" placeholder={selectedEngineer ? "Search available engineer stock..." : "Select engineer first"} disabled={!selectedEngineer || itemsLoading} value={selectedItem ? `${selectedItem.item_code} - ${selectedItem.description}` : itemSearch} onChange={(e) => { setSelectedItem(null); setItemSearch(e.target.value); }}/></div>{!selectedItem && itemSearch && <div className="rmi-suggestions">{matchingItems.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedItem(item); setItemSearch(""); }}>{item.item_code} — {item.description}<span>Available: {Number(item.available_qty).toLocaleString()}</span></button>)}{!matchingItems.length && <div className="rmi-no-match">No matching available stock.</div>}</div>}{itemsLoading && <small className="muted">Loading engineer stock...</small>}</div>
        {selectedItem && <div className="form-grid rmi-item-details"><div className="field"><label>Description</label><input readOnly value={selectedItem.description}/></div><div className="field"><label>Part Number</label><input readOnly value={selectedItem.part_number || ""}/></div><div className="field"><label>Model Number</label><input readOnly value={selectedItem.model_number || ""}/></div><div className="field"><label>Available Qty</label><input readOnly value={Number(selectedItem.available_qty).toLocaleString()}/></div></div>}
        <div className="form-grid rmi-input-grid"><div className="field"><label htmlFor="rmi-qty">RMI Qty</label><input id="rmi-qty" type="number" min="0.000001" step="any" value={rmiQty} onChange={(e) => setRmiQty(e.target.value)} required/></div><div className="field"><label htmlFor="rmi-date">RMI Date</label><input id="rmi-date" type="date" value={rmiDate} onChange={(e) => setRmiDate(e.target.value)} required/></div><div className="field"><label htmlFor="rmi-no">RMI No</label><input id="rmi-no" value={rmiNo} onChange={(e) => setRmiNo(e.target.value)} maxLength={100} required/></div></div>
        <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving || itemsLoading || !selectedEngineer || !selectedItem}>{saving ? "Saving..." : editingId ? "Update RMI" : "Save RMI"}</button></div>
      </form>
    </section></div>}
    <ConfirmModal open={Boolean(deleteTarget)} title="Delete RMI" message={deleteTarget ? `Delete RMI ${deleteTarget.rmi_no}? The consumed quantity will be returned to the engineer's available balance.` : "Are you sure?"} confirmText="Delete" busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={deleteRmi}/>
  </main>;
}
