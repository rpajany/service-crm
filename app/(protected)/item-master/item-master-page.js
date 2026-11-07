"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Pencil, Trash2, RefreshCw, Package } from "lucide-react";
import ItemMasterModal from "@/app/components/item-master/ItemMasterModal";
import ConfirmModal from "@/app/components/common/ConfirmModal";

const columns = [
  ["item_code", "Item Code"], ["part_number", "Part Number"], ["model_number", "Model Number"],
  ["description", "Description"], ["qty", "Qty"], ["supplier_name", "Supplier Name"],
  ["purchase_price", "Purchase Price"], ["selling_price", "Selling Price"], ["gst", "GST %"], ["hsn_code", "HSN Code"]
];

export default function ItemMasterPage() {
  const [canWrite, setCanWrite] = useState(false); const [canDelete, setCanDelete] = useState(false); const [confirmDelete, setConfirmDelete] = useState(null); const [deleteBusy, setDeleteBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/item-master", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load items.");
      setItems(data.items || []);
      setCanWrite(!!data.permissions?.canWrite); setCanDelete(!!data.permissions?.canDelete);
    } catch (loadError) {
      setError(loadError.message || "Unable to load items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => columns.some(([key]) => String(item[key] ?? "").toLowerCase().includes(term)));
  }, [items, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  function openNew() { setEditingItem(null); setModalOpen(true); }
  function openEdit(item) { setEditingItem(item); setModalOpen(true); }
  function onSaved(savedItem) {
    setItems((previous) => {
      const exists = previous.some((entry) => entry.id === savedItem.id);
      return exists ? previous.map((entry) => entry.id === savedItem.id ? savedItem : entry) : [...previous, savedItem].sort((a, b) => a.item_code.localeCompare(b.item_code));
    });
  }

  async function removeItem(item) {
    setDeleteBusy(true); setError("");
    try {
      const response = await fetch(`/api/item-master?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete item.");
      setItems((previous) => previous.filter((entry) => entry.id !== item.id)); setConfirmDelete(null);
    } catch (deleteError) { setError(deleteError.message || "Unable to delete item."); }
    finally { setDeleteBusy(false); }
  }

  function exportExcel() {
    // Excel opens UTF-8 CSV files; quoting each cell protects commas and line breaks.
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.map(([, label]) => escapeCell(label)).join(","), ...filtered.map((item) => columns.map(([key]) => escapeCell(item[key])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `item-master-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="content">
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">ItemMaster</h1>
          <p className="muted" style={{ marginTop: 8 }}>Maintain item codes, pricing, stock quantity, GST and HSN details.</p>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-export" type="button" onClick={exportExcel} disabled={!filtered.length}><Download size={16} /> Export to Excel</button>
          {canWrite && <button className="btn btn-primary" type="button" onClick={openNew}><Plus size={17} /> Add Item</button>}
        </div>
      </div>

      <section className="card item-table-card">
        <div className="table-toolbar">
          <div className="search-box"><Search size={18} /><input aria-label="Search items" placeholder="Search code, part number, description, supplier..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <button className="btn btn-secondary" type="button" onClick={loadItems} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? <div className="empty-state">Loading items...</div> : visible.length === 0 ? (
          <div className="empty-state"><Package size={30} /><strong>{search ? "No matching items" : "No items added yet"}</strong><span>{search ? "Try another search term." : "Add your first item to start building your item master."}</span>{!search && canWrite && <button className="btn btn-primary" type="button" onClick={openNew}><Plus size={16} /> Add Item</button>}</div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>
            {visible.map((item) => <tr key={item.id}>
              {columns.map(([key]) => <td key={key}>{["purchase_price", "selling_price"].includes(key) ? Number(item[key] || 0).toFixed(2) : key === "gst" ? `${Number(item[key] || 0)}%` : item[key] ?? "—"}</td>)}
              <td><div className="row-actions">{canWrite && <button className="icon-button" type="button" onClick={() => openEdit(item)} title={`Edit ${item.item_code}`} aria-label={`Edit ${item.item_code}`}><Pencil size={16} /></button>}{canDelete && <button className="icon-button danger-button" type="button" onClick={() => setConfirmDelete(item)} title={`Delete ${item.item_code}`} aria-label={`Delete ${item.item_code}`}><Trash2 size={16} /></button>}</div></td>
            </tr>)}
          </tbody></table></div>
        )}
        <div className="table-footer">
          <span className="muted">Showing {filtered.length ? (Math.min(page, totalPages) - 1) * pageSize + 1 : 0}–{Math.min(page, totalPages) * pageSize} of {filtered.length} items</span>
          <div className="pagination-controls"><label className="muted">Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="muted">Page {Math.min(page, totalPages)} of {totalPages}</span><button className="btn btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </div>
      </section>
      <ItemMasterModal isOpen={modalOpen} item={editingItem} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      <ConfirmModal open={!!confirmDelete} title="Delete Item" message={`Are you sure you want to delete ${confirmDelete?.item_code || "this item"}? This action cannot be undone.`} confirmText="Delete" busy={deleteBusy} onCancel={() => setConfirmDelete(null)} onConfirm={() => removeItem(confirmDelete)} />
    </main>
  );
}
