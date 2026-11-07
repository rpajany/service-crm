"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, RefreshCw, Boxes, ArrowDownUp } from "lucide-react";

const columns = [
  ["type", "Type"], ["invoice_number", "Invoice Number"], ["invoice_date", "Invoice Date"],
  ["item_name", "Item Name"], ["part_number", "PartNumber"], ["model_number", "ModelNumber"],
  ["stock_qty", "Stock Qty"], ["transact_qty", "Transact Qty"], ["hand_stock_qty", "HandStock Qty"],
  ["remarks", "Remarks"], ["created_at", "created_at"]
];

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}
function dateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
function typeLabel(type) {
  return ({ itemmaster: "ItemMaster", purchase: "Purchase", sales: "Sales", adjustment: "Adjustment", reversal: "Reversal", engineer_issue: "Engineer Stock Issue" })[type] || type || "—";
}

export default function StockSummaryPage() {
  const [movements, setMovements] = useState([]);
  const [currentItems, setCurrentItems] = useState([]);
  const [from, setFrom] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; });
  const [to, setTo] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`; });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (search.trim()) params.set("search", search.trim());
      if (type !== "all") params.set("type", type);
      const response = await fetch(`/api/stock-summary?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Stock Summary.");
      setMovements(data.movements || []);
      setCurrentItems(data.currentItems || []);
      setLimited(Boolean(data.limited));
      setPage(1);
    } catch (loadError) {
      setError(loadError.message || "Unable to load Stock Summary.");
    } finally {
      setLoading(false);
    }
  }, [from, to, search, type]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize));
  const visible = useMemo(() => movements.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize), [movements, page, pageSize, totalPages]);
  const currentStockTotal = currentItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  function exportExcel() {
    // CSV is Excel-compatible and avoids adding a new package dependency.
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [columns.map(([, label]) => escapeCell(label)).join(",")];
    for (const movement of movements) {
      const values = columns.map(([key]) => {
        if (key === "type") return typeLabel(movement.type);
        if (key === "invoice_date") return dateOnly(movement.invoice_date);
        if (key === "created_at") return dateTime(movement.created_at);
        return movement[key];
      });
      rows.push(values.map(escapeCell).join(","));
    }
    const blob = new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportCurrentStock() {
    const stockColumns = [["item_code", "Item Code"], ["item_name", "Item Name"], ["part_number", "PartNumber"], ["model_number", "ModelNumber"], ["qty", "Current Qty"]];
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [stockColumns.map(([, label]) => escapeCell(label)).join(","), ...currentItems.map((item) => stockColumns.map(([key]) => escapeCell(item[key])).join(","))];
    const blob = new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `current-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  return (
    <main className="content">
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">Stock Summary</h1>
          <p className="muted" style={{ marginTop: 8 }}>Review stock movements from ItemMaster and, when added, Purchase and Sales entries.</p>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-secondary" type="button" onClick={exportExcel} disabled={!movements.length}><Download size={16} /> Export Movements</button>
          <button className="btn btn-secondary" type="button" onClick={exportCurrentStock} disabled={!currentItems.length}><Download size={16} /> Export Current Stock</button>
        </div>
      </div>

      <section className="stat-grid" style={{ marginBottom: 18 }}>
        <section className="card"><div className="muted">Items in ItemMaster</div><div className="stat-number">{currentItems.length}</div><div className="muted">Current item count</div></section>
        <section className="card"><div className="muted">Current Total Quantity</div><div className="stat-number">{currentStockTotal.toLocaleString()}</div><div className="muted">Sum of ItemMaster.qty</div></section>
        <section className="card"><div className="muted">Movement Records</div><div className="stat-number">{movements.length}{limited ? "+" : ""}</div><div className="muted">Based on selected filters</div></section>
      </section>

      <section className="card item-table-card">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field"><label htmlFor="stock-from">From Date</label><input id="stock-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></div>
          <div className="field"><label htmlFor="stock-to">To Date</label><input id="stock-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></div>
          <div className="field"><label htmlFor="stock-type">Transaction Type</label><select id="stock-type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option><option value="itemmaster">ItemMaster</option><option value="purchase">Purchase</option><option value="sales">Sales</option><option value="adjustment">Adjustment</option><option value="reversal">Reversal</option></select></div>
          <div className="field"><label htmlFor="stock-search">Search</label><div className="search-box"><Search size={18} /><input id="stock-search" placeholder="Invoice, item, part, model, remarks..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        </div>
        <div className="table-toolbar">
          <div className="muted"><ArrowDownUp size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Movement history (latest first)</div>
          <button className="btn btn-secondary" type="button" onClick={loadReport} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {limited && <div className="alert" style={{ marginBottom: 12 }}>Showing the latest 5,000 matching movement records. Narrow the date range to export a smaller report.</div>}
        {loading ? <div className="empty-state">Loading stock movements...</div> : visible.length === 0 ? (
          <div className="empty-state"><Boxes size={30} /><strong>No stock movements found</strong><span>New ItemMaster entries and quantity changes will appear here. Adjust your filters or add an item in ItemMaster.</span></div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>
            {visible.map((row) => <tr key={row.id}>
              <td>{typeLabel(row.type)}</td><td>{row.invoice_number || "—"}</td><td>{dateOnly(row.invoice_date)}</td>
              <td>{row.item_name}</td><td>{row.part_number || "—"}</td><td>{row.model_number || "—"}</td>
              <td>{Number(row.stock_qty || 0).toLocaleString()}</td><td>{Number(row.transact_qty || 0) > 0 ? "+" : ""}{Number(row.transact_qty || 0).toLocaleString()}</td>
              <td>{Number(row.hand_stock_qty || 0).toLocaleString()}</td><td>{row.remarks || "—"}</td><td>{dateTime(row.created_at)}</td>
            </tr>)}
          </tbody></table></div>
        )}
        <div className="table-footer">
          <span className="muted">Showing {movements.length ? (Math.min(page, totalPages) - 1) * pageSize + 1 : 0}–{Math.min(page, totalPages) * pageSize} of {movements.length} movement records</span>
          <div className="pagination-controls"><label className="muted">Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="muted">Page {Math.min(page, totalPages)} of {totalPages}</span><button className="btn btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </div>
      </section>

      <section className="card item-table-card" style={{ marginTop: 20 }}>
        <div className="page-heading-row"><div><h2 style={{ margin: 0, fontSize: 18 }}>Current Stock by Item</h2><p className="muted" style={{ marginTop: 6 }}>Current quantities come directly from ItemMaster.qty and are not affected by the movement date filters.</p></div></div>
        {currentItems.length === 0 ? <div className="empty-state">No items found in ItemMaster.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Item Code</th><th>Item Name</th><th>Part Number</th><th>Model Number</th><th>Current Qty</th></tr></thead><tbody>{currentItems.map((item) => <tr key={item.id}><td>{item.item_code}</td><td>{item.item_name}</td><td>{item.part_number || "—"}</td><td>{item.model_number || "—"}</td><td>{Number(item.qty || 0).toLocaleString()}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
