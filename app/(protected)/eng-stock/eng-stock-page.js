"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, RefreshCw, Package, ArrowRightLeft, Users } from "lucide-react";

function currentMonthRange() {
  const now = new Date();
  const date = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { from: date(new Date(now.getFullYear(), now.getMonth(), 1)), to: date(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB");
}
function exportRows(filename, headers, rows) {
  // CSV is Excel-compatible and keeps this page lightweight without another dependency.
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export default function EngStockPage() {
  const initialRange = useMemo(currentMonthRange, []);
  const [tab, setTab] = useState("entry");
  const [items, setItems] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [canIssue, setCanIssue] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [engineerSearch, setEngineerSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [issueQty, setIssueQty] = useState("1");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [storeItems, setStoreItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load ItemMaster and active engineer choices once; changing report filters does not reload them.
  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    try {
      const response = await fetch("/api/engineer-stock?view=lookups", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load items and engineers.");
      setItems(data.items || []); setEngineers(data.engineers || []); setCanIssue(Boolean(data.canIssue));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoadingLookups(false); }
  }, []);
  useEffect(() => { loadLookups(); }, [loadLookups]);

  // Fetch only the active tab's report. A short debounce avoids one request per typed character.
  const loadTable = useCallback(async () => {
    if (tab === "entry") return;
    setLoadingTable(true); setError("");
    try {
      const params = new URLSearchParams({ view: tab === "store" ? "store" : "summary", from, to, search });
      const response = await fetch(`/api/engineer-stock?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load engineer stock report.");
      if (tab === "store") setStoreItems(data.items || []); else setSummary(data.rows || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoadingTable(false); }
  }, [tab, from, to, search]);
  useEffect(() => {
    if (tab === "entry") return undefined;
    const timer = setTimeout(loadTable, 250);
    return () => clearTimeout(timer);
  }, [loadTable, tab]);

  const matchingItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return items.slice(0, 12);
    return items.filter((item) => [item.item_code, item.description, item.part_number, item.model_number].some((value) => String(value || "").toLowerCase().includes(term))).slice(0, 12);
  }, [items, itemSearch]);
  const matchingEngineers = useMemo(() => {
    const term = engineerSearch.trim().toLowerCase();
    if (!term) return engineers.slice(0, 12);
    return engineers.filter((engineer) => engineer.username.toLowerCase().includes(term) || engineer.fullName.toLowerCase().includes(term)).slice(0, 12);
  }, [engineers, engineerSearch]);

  async function issueStock(event) {
    event.preventDefault(); setError(""); setNotice("");
    if (!selectedItem || !selectedEngineer) { setError("Select an item and an engineer before saving."); return; }
    if (!Number.isFinite(Number(issueQty)) || Number(issueQty) <= 0) { setError("Enter an issue quantity greater than zero."); return; }
    if (Number(issueQty) > Number(selectedItem.qty)) { setError(`Available ItemMaster stock is ${selectedItem.qty}.`); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/engineer-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: selectedItem.id, engineer_id: selectedEngineer.id, issue_qty: issueQty, issue_date: issueDate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to issue stock.");
      setNotice(data.message || "Stock issued successfully.");
      setSelectedItem(null); setSelectedEngineer(null); setItemSearch(""); setEngineerSearch(""); setIssueQty("1");
      // Refresh the source quantity so the next issue cannot use an outdated displayed balance.
      await loadLookups();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  // Export the current EngineerStore item balances, not individual issue transactions.
  function exportStore() {
    exportRows(`eng-store-${new Date().toISOString().slice(0, 10)}.csv`, ["Item Code", "Description", "Part Number", "Model Number", "Total Qty"], storeItems.map((row) => [row.item_code, row.description, row.part_number, row.model_number, row.total_qty]));
  }
  function exportSummary() {
    exportRows(`stock-by-engineer-${new Date().toISOString().slice(0, 10)}.csv`, ["Engineer", "Item Code", "Description", "Part Number", "Model Number", "Total Qty", "Latest Issue Date"], summary.map((row) => [row.eng_name, row.item_code, row.description, row.part_number, row.model_number, row.total_qty, displayDate(row.latest_issue_date)]));
  }

  const tabs = [{ id: "entry", label: "EngStock_Entry" }, { id: "store", label: "Eng_Store" }, { id: "summary", label: "StockByEng" }];
  return (
    <main className="content">
      <div className="page-heading-row"><div><h1 className="page-title">Eng Stock</h1><p className="muted" style={{ marginTop: 8 }}>Issue stock from ItemMaster to individual engineers and review engineer-wise balances.</p></div></div>
      <div role="tablist" aria-label="Engineer stock sections" className="eng-stock-tabs">
        {tabs.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} className={`eng-stock-tab ${tab === entry.id ? "active" : ""}`} onClick={() => { setTab(entry.id); setError(""); setNotice(""); }}>{entry.label}</button>)}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {tab === "entry" ? (
        <section className="card eng-stock-entry-card">
          <div className="eng-stock-title">Engineer Stock</div>
          {loadingLookups ? <div className="empty-state">Loading ItemMaster items and engineers...</div> : (
            <form onSubmit={issueStock} className="eng-stock-form">
              <div className="field eng-stock-search-field"><label htmlFor="eng-item-search">Search Item</label><div className="search-box"><Search size={18}/><input id="eng-item-search" autoComplete="off" placeholder="Search by item code, name, part number or model number..." value={selectedItem ? `${selectedItem.item_code} - ${selectedItem.description}` : itemSearch} onChange={(event) => { setSelectedItem(null); setItemSearch(event.target.value); }}/></div>
                {!selectedItem && itemSearch && <div className="eng-stock-suggestions">{matchingItems.length ? matchingItems.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedItem(item); setItemSearch(""); }}>{item.item_code} — {item.description} <span>Available: {Number(item.qty).toLocaleString()}</span></button>) : <div className="eng-stock-no-match">No matching ItemMaster item.</div>}</div>}
              </div>
              {selectedItem && <div className="form-grid eng-stock-item-details"><div className="field"><label>Item Name</label><input readOnly value={selectedItem.description}/></div><div className="field"><label>Part Number</label><input readOnly value={selectedItem.part_number || ""}/></div><div className="field"><label>Model Number</label><input readOnly value={selectedItem.model_number || ""}/></div><div className="field"><label>Available ItemMaster Qty</label><input readOnly value={Number(selectedItem.qty).toLocaleString()}/></div></div>}
              <div className="eng-stock-issue-row"><div className="field"><label htmlFor="eng-issue-qty">Stock Issue Qty</label><input id="eng-issue-qty" type="number" min="0.000001" step="any" value={issueQty} onChange={(event) => setIssueQty(event.target.value)} required/></div><div className="field"><label htmlFor="eng-issue-date">Stock Issue Date</label><input id="eng-issue-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required/></div></div>
              <div className="field eng-stock-engineer-field"><label htmlFor="eng-engineer-search">Eng Name (search by username)</label><div className="search-box"><Users size={18}/><input id="eng-engineer-search" autoComplete="off" placeholder="Search active engineer username..." value={selectedEngineer ? `${selectedEngineer.username} (${selectedEngineer.fullName})` : engineerSearch} onChange={(event) => { setSelectedEngineer(null); setEngineerSearch(event.target.value); }}/></div>
                {!selectedEngineer && engineerSearch && <div className="eng-stock-suggestions">{matchingEngineers.length ? matchingEngineers.map((engineer) => <button type="button" key={engineer.id} onClick={() => { setSelectedEngineer(engineer); setEngineerSearch(""); }}>{engineer.username} <span>{engineer.fullName}</span></button>) : <div className="eng-stock-no-match">No active engineer found.</div>}</div>}
              </div>
              <div className="eng-stock-form-actions"><button className="btn btn-primary" type="submit" disabled={!canIssue || saving || loadingLookups}><ArrowRightLeft size={16}/>{saving ? "Saving..." : "Save Stock Issue"}</button></div>
            </form>
          )}
        </section>
      ) : (
        <section className="card item-table-card">
          {tab === "summary" && <div className="form-grid eng-stock-filters"><div className="field"><label htmlFor="eng-from">From Date</label><input id="eng-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)}/></div><div className="field"><label htmlFor="eng-to">To Date</label><input id="eng-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}/></div><div className="field"><label htmlFor="eng-search">Search</label><div className="search-box"><Search size={18}/><input id="eng-search" placeholder="Engineer, item code, description..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></div></div>}
          {tab === "store" && <div className="form-grid eng-stock-filters"><div className="field"><label htmlFor="eng-store-search">Search</label><div className="search-box"><Search size={18}/><input id="eng-store-search" placeholder="Item code, description, part number..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></div></div>}
          <div className="table-toolbar"><div className="muted">{tab === "store" ? "Engineer Store item balances" : "Current issued quantity by engineer and item"}</div><div className="toolbar-actions"><button className="btn btn-secondary" type="button" onClick={loadTable} disabled={loadingTable}><RefreshCw size={16}/> Refresh</button><button className="btn eng-stock-export-btn" type="button" onClick={tab === "store" ? exportStore : exportSummary} disabled={loadingTable || (tab === "store" ? !storeItems.length : !summary.length)}><Download size={16}/> Export Excel</button></div></div>
          {loadingTable ? <div className="empty-state">Loading engineer stock...</div> : tab === "store" ? (
            storeItems.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Item Code</th><th>Description</th><th>Part Number</th><th>Model Number</th><th>Total Qty</th></tr></thead><tbody>{storeItems.map((row) => <tr key={row.id}><td>{row.item_code}</td><td>{row.description}</td><td>{row.part_number || "—"}</td><td>{row.model_number || "—"}</td><td>{Number(row.total_qty).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Package size={28}/><strong>No items in Engineer Store</strong><span>Items issued from ItemMaster will appear here with their combined quantity.</span></div>
          ) : summary.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Engineer</th><th>Item Code</th><th>Description</th><th>Part Number</th><th>Model Number</th><th>Total Qty</th><th>Latest Issue Date</th></tr></thead><tbody>{summary.map((row, index) => <tr key={`${row.engineer_id}-${row.item_code}-${index}`}><td>{row.eng_name}</td><td>{row.item_code}</td><td>{row.description}</td><td>{row.part_number || "—"}</td><td>{row.model_number || "—"}</td><td>{Number(row.total_qty).toLocaleString()}</td><td>{displayDate(row.latest_issue_date)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Users size={28}/><strong>No engineer stock balances found</strong><span>Issue stock to an engineer to see the item-wise balance here.</span></div>}
          <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Reports are limited to the latest 5,000 matching records where applicable.</div>
        </section>
      )}
    </main>
  );
}
