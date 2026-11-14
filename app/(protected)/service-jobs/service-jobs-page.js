"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  X,
  UserPlus,
  Printer,
} from "lucide-react";
import CustomerModal from "@/app/components/customers/CustomerModal";
import ConfirmModal from "@/app/components/common/ConfirmModal";
import { useToast } from "@/app/components/common/ToastProvider";

const today = new Date().toISOString().slice(0, 10);
const blankProduct = () => ({
  product_type: "",
  sl_no: "",
  brand: "",
  model_name: "",
  model_number: "",
  status: "",
  problem_reported: "",
});
const blank = {
  job_date: today,
  service_no: "",
  service_type: "Carry In",
  customer_id: "",
  customer_name: "",
  mobile: "",
  email: "",
  address: "",
  gstin: "",
  product_type: "",
  brand: "",
  model_name: "",
  model_number: "",
  sl_no: "",
  product_color: "",
  product_config: "",
  password_pattern_lock: "",
  status: "",
  problem_reported: "",
  condition_of_product: "",
  estimated_cost: 0,
  advance_received: 0,
  expected_delivery_date: "",
  remarks: "",
  engineer_id: "",
  initial_check_date: "",
  revised_estimate: 0,
  problem_diagnosed: "",
  move_to: "Open",
  service_date: "",
  service_remarks_engineer: "",
  service_remarks_customer: "",
  billing_type: "",
  total_pages: 0,
};
const filters = [
  "All",
  "Open",
  "Return without service",
  "Customer Pending",
  "Customer Approved",
  "Service Completed",
  "Delivered",
];
const statusColors = {
  Open: "#dc2626",
  "Return without service": "#64748b",
  "Customer Pending": "#d97706",
  "Customer Approved": "#2563eb",
  "Service Completed": "#15803d",
  Delivered: "#7c3aed",
};
const sections = [
  [
    "Customer Information",
    [
      ["service_no", "Service No."],
      ["customer_name", "Customer Name *"],
      ["mobile", "Mobile"],
      ["email", "Email"],
      ["address", "Address"],
      ["gstin", "GSTIN"],
    ],
  ],
  [
    "Service & Payment Information",
    [
      ["estimated_cost", "Service Amount", "number"],
      ["advance_received", "Advance Paid", "number"],
      ["condition_of_product", "Condition of Product"],
      ["expected_delivery_date", "Expected Delivery Date", "date"],
      ["remarks", "Remarks", "textarea"],
      ["engineer_id", "Assign Engineer", "engineer"],
    ],
  ],
  [
    "Initial Check Information",
    [
      ["initial_check_date", "Initial Check Date", "date"],
      ["revised_estimate", "Revised Estimate", "number"],
      ["problem_diagnosed", "Problem Diagnosed"],
      ["move_to", "Move To", "select"],
    ],
  ],
  [
    "Service Information",
    [
      ["service_date", "Service Date", "date"],
      ["service_remarks_engineer", "Service Remarks (Engineer)"],
      ["service_remarks_customer", "Service Remarks (Customer)", "textarea"],
      ["billing_type", "Billing Type", "select"],
      ["total_pages", "Total Pages", "number"],
    ],
  ],
];

export default function ServiceJobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]),
    [meta, setMeta] = useState({ engineers: [], settings: {}, prefix: "MSP" });
  const [from, setFrom] = useState(
      new Date().toISOString().slice(0, 7) + "-01"
    ),
    [to, setTo] = useState(today),
    [search, setSearch] = useState(""),
    [moveFilter, setMoveFilter] = useState("All");
  const [modal, setModal] = useState(false),
    [customerOpen, setCustomerOpen] = useState(false),
    [customerSearch, setCustomerSearch] = useState(""),
    [customerListOpen, setCustomerListOpen] = useState(false),
    [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [editId, setEditId] = useState(""),
    [form, setForm] = useState(blank),
    [customers, setCustomers] = useState([]),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [canDelete, setCanDelete] = useState(false),
    [canWrite, setCanWrite] = useState(false),
    [errors, setErrors] = useState({});
  const visibleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return (customers || [])
      .filter(
        (c) =>
          !q ||
          `${c.customer_name || ""} ${c.mobile || ""} ${c.gstin || ""}`
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 30);
  }, [customers, customerSearch]);
  async function load() {
    try {
      const [r, m, c] = await Promise.all([
        fetch(
          `/api/service-jobs?from=${from}&to=${to}&search=${encodeURIComponent(
            search
          )}`
        ),
        fetch("/api/service-jobs?meta=1"),
        fetch("/api/customers"),
      ]);
      const d = await r.json(),
        md = await m.json(),
        cd = await c.json();
      if (!r.ok) throw Error(d.error);
      setJobs(d.jobs || []);
      setCanDelete(!!d.permissions?.canDelete);
      setCanWrite(!!d.permissions?.canWrite);
      if (m.ok) setMeta(md);
      if (c.ok) setCustomers(cd.customers || []);
    } catch (e) {
      toast(e.message, "error");
    }
  }
  useEffect(() => {
    load();
  }, [from, to, search]);
  useEffect(() => {
    if (!customerListOpen) return;
    const option = document.querySelector(
      `[data-customer-option="${activeCustomerIndex}"]`
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [activeCustomerIndex, customerListOpen]);
  function start(job = null) {
    setEditId(job?.id || "");
    const legacyProduct = job
      ? {
          product_type: job.product_type || "",
          sl_no: job.sl_no || "",
          brand: job.brand || "",
          model_name: job.model_name || "",
          model_number: job.model_number || "",
          status: job.status || "",
          problem_reported: job.problem_reported || "",
        }
      : blankProduct();
    const f = job
      ? {
          ...blank,
          ...job,
          products:
            Array.isArray(job.products) && job.products.length
              ? job.products
              : [legacyProduct],
          job_date: job.job_date?.slice(0, 10) || today,
          expected_delivery_date:
            job.expected_delivery_date?.slice(0, 10) || "",
          initial_check_date: job.initial_check_date?.slice(0, 10) || "",
          service_date: job.service_date?.slice(0, 10) || "",
        }
      : { ...blank, products: [blankProduct()] };
    setForm(f);
    const customer = customers.find((c) => c.id === f.customer_id);
    setCustomerSearch(
      customer
        ? `${customer.customer_name} - ${customer.mobile || ""}`
        : f.customer_name || ""
    );
    setErrors({});
    setModal(true);
  }
  function chooseCustomer(c) {
    setActiveCustomerIndex(0);
    setForm((v) => ({
      ...v,
      customer_id: c.id,
      customer_name: c.customer_name,
      mobile: c.mobile || "",
      email: c.email || "",
      address: c.address || "",
      gstin: c.gstin || "",
    }));
    setCustomerSearch(`${c.customer_name} - ${c.mobile || ""}`);
    setCustomerListOpen(false);
    setCustomerOpen(false);
    setErrors((v) => ({ ...v, customer_id: "" }));
  }
  async function save(e) {
    e.preventDefault();
    const next = {};
    if (!form.job_date) next.job_date = "Job Date is required.";
    if (!form.customer_id || !form.customer_name?.trim())
      next.customer_id = "Please select a customer.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast(Object.values(next)[0], "error");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/service-jobs", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          products: (form.products || []).slice(0, 3),
          ...(editId ? { id: editId } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      toast(d.message);
      setModal(false);
      await load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      const r = await fetch(`/api/service-jobs?id=${confirm.id}`, {
          method: "DELETE",
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      toast(d.message);
      setConfirm(null);
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function printJob(job) {
    const esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[c])
      );
    const date = (v) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
    let printMeta = meta;
    try {
      const response = await fetch("/api/service-jobs?meta=1", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) printMeta = payload;
    } catch (error) {
      console.error("Unable to refresh Service Job print metadata:", error);
    }
    // Only the service_job settings are supplied by this endpoint; never use quotation/sales terms here.
    const rawTerms = printMeta?.settings?.["Terms & Conditions"];
    const terms = (Array.isArray(rawTerms) ? rawTerms : [])
      .map((x) =>
        String(typeof x === "string" ? x : x?.value || x?.text || "").trim()
      )
      .filter(Boolean);
    const c = printMeta?.company || {};
    const products = (
      Array.isArray(job.products) && job.products.length
        ? job.products
        : [
            {
              product_type: job.product_type,
              sl_no: job.sl_no,
              brand: job.brand,
              model_name: job.model_name,
              model_number: job.model_number,
              status: job.status,
              problem_reported: job.problem_reported,
            },
          ]
    ).slice(0, 3);

    // HP-specific print template.
    // This returns HTML fragments because the existing Service Job print
    // is generated in a separate browser window using window.document.write().
    function HP_PrintTemplet() {
      // Keep the HP logo self-contained so no external image URL is required.

      // const hpLogo = `
      //   <svg xmlns="http://www.w3.org/2000/svg"
      //        width="48" height="42" viewBox="0 0 100 100"
      //        role="img" aria-label="HP logo">
      //     <circle cx="50" cy="50" r="47" fill="#0096D6"/>
      //     <text x="50" y="68"
      //           text-anchor="middle"
      //           font-family="Arial, sans-serif"
      //           font-size="58"
      //           font-style="italic"
      //           font-weight="bold"
      //           fill="#ffffff">hp</text>
      //   </svg>
      // `;

      const hpLogo = `
                    <img
                      src="/images/HP_logo.png"
                      alt="HP Logo"
                      class="hp-logo"
                    />
      `;

      // These terms are transcribed from the supplied HP reference image.
      const hpTerms = [
        "The terms and conditions as contained in the product warranty statement or additional CarePAQ applicable to the particular model shall be applicable for the repairs relating to the same.",

        "In case of units not covered under warranty, the customers shall fill-in the Quotation Acceptance form in token of acceptance of the quotation offered by HP.",

        "HP India Sales Private Limited reserves the right to dispose off any equipment which is not claimed by the customer from the date of receipt of this CSO form/Quotation acceptance form in case of units not covered under warranty. In such an event, the customer acknowledges that he/she shall have no claim against HP in respect of such equipment, which is disposed off by HP. Further demurrage charges shall be applicable on the units @ Rs. 500/- per month if the machine is not collected from HP Care within 1 month from the date of receipt of this CSO form/Last Quotation.",
      ];

      return {
        logoHtml: hpLogo,

        titleHtml: `
      <div class="hp-report-title">
        Customer Service Report
      </div>
    `,

        termsTitleHtml: `
      <div class="terms-title hp-terms-title">
        UEFI Code : Terms and Conditions
      </div>
    `,

        termsHtml: hpTerms.map((term) => `<li>${esc(term)}</li>`).join(""),
      };
    }

    // Use the HP template if at least one product in this job has Brand exactly "HP".
    const isHpJob = products.some(
      (product) => String(product.brand || "").trim() === "HP"
    );

    const hpTemplate = isHpJob ? HP_PrintTemplet() : null;

    // Keep the existing company logo for every non-HP brand.
    const reportLogoHtml = isHpJob
      ? hpTemplate.logoHtml
      : ((c) =>
          c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="Company logo">` : "")(
          printMeta?.company || {}
        );

    const money = (v) =>
      Number(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const serviceAmount = Number(job.estimated_cost || 0),
      advance = Number(job.advance_received || 0),
      balance = Math.max(0, serviceAmount - advance);
    const address = [
      c.address?.street,
      c.address?.city,
      c.address?.state,
      c.address?.postalCode,
      c.address?.country,
    ]
      .filter(Boolean)
      .join(", ");
    const contact = [c.phone, c.email, c.website].filter(Boolean).join(" | ");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast("Please allow pop-ups to print the job report.", "error");
      return;
    }
    w.document
      .write(`<!doctype html><html><head><meta charset="utf-8"><title>Service Job ${esc(
      job.job_sheet_no
    )}</title><style>
  @page{size:A4;margin:8mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#111;margin:0}.paper{width:100%;} .company-head{display:flex;gap:10px;text-align:right;border-bottom:1px solid #555;padding:0 0 7px;margin-bottom:5px;min-height:54px}.company-head img{width:48px;height:42px;object-fit:contain}
  
/* HP-specific Customer Service Report heading */

.hp-logo {
  width: 48px;
  height: 42px;
  object-fit: contain;
  display: block;
}
  
.hp-report-title {
  background: #52657f;
  color: #ffffff;
  font-size: 15px;
  font-weight: bold;
  padding: 5px 10px;
  width: 48%;
  border-radius: 3px;
  margin: 5px 0 8px;
  text-align: left;
}

.hp-terms-title {
  font-size: 9px;
  font-weight: bold;
  margin-top: 8px;
}

  .company-copy{flex:1}
  .company-copy h1{font-size:17px;margin:0 0 3px}
  .company-copy div{font-size:10px;line-height:1.35}.gst{font-weight:bold}.meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #777;padding:4px 0 8px;margin-bottom:12px;font-size:11px;line-height:1.55}.meta strong{font-size:12px}.meta-right{text-align:left}.section-title{font-weight:bold;font-size:12px;margin:0 0 4px}.products{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 12px}.products th,.products td{border:1.5px solid #111;padding:5px 3px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}.products th{font-size:9px;font-weight:bold}.products td{font-size:9px;height:25px}.products th:nth-child(1){width:19%}.products th:nth-child(2){width:10%}.products th:nth-child(3){width:9%}.products th:nth-child(4){width:10%}.products th:nth-child(5){width:13%}.products th:nth-child(6){width:19%}.products th:nth-child(7){width:20%}.amounts{font-size:11px;padding:2px 0 9px;border-bottom:1px solid #777;margin-bottom:9px;display:flex;gap:18px;flex-wrap:wrap}.terms-title{font-size:9px;font-weight:bold;margin:0 0 5px}.terms{font-size:10px;line-height:1.35;margin:0 0 8px;padding-left:17px}.terms li{margin:0 0 4px;break-inside:avoid}.footer{border-top:1px solid #777;margin-top:9px;padding-top:8px;min-height:74px}.footer-date{font-size:11px;margin-bottom:12px}.signatures{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-top:4px}.frontdesk-area{width:40%;text-align:left;display:flex;flex-direction:column;align-items:flex-start}.frontdesk-area img{max-width:90px;max-height:65px;object-fit:contain;display:block;margin:0 0 5px}.frontdesk-caption{font-size:9px}.signature{width:30%;border-top:1px solid #222;text-align:center;padding-top:5px;font-size:9px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.products tr{break-inside:avoid}}
  </style></head><body><main class="paper">
<header class="company-head">
 <div style="width:500px;">
   ${reportLogoHtml}
  ${hpTemplate ? hpTemplate.titleHtml : ""}
 </div>

 

  <div class="company-copy">
    <h1>${esc(c.name || "")}</h1>
<div>${esc(address)}</div><div>${esc(contact)}</div>${
      c.gstNumber ? `<div class="gst">GSTIN: ${esc(c.gstNumber)}</div>` : ""
    }
  </div>
</header>
 
  <section class="meta"><div><strong>Customer Details :</strong><br>${esc(
    job.customer_name
  )}<br>${esc(job.address)}<br>${esc(job.mobile)}<br>${esc(job.email)}<br>${esc(
      job.gstin
    )}</div><div class="meta-right"><strong>Job Sheet No. : ${esc(
      job.job_sheet_no
    )}</strong><br><strong>Job Sheet Date :</strong> ${esc(
      date(job.job_date)
    )}</div></section>
  <div class="section-title">Product Information :</div><table class="products"><thead><tr><th>Product</th><th>Sl No.</th><th>Brand</th><th>Model</th><th>Model No.</th><th>Product Status</th><th>Reported Fault</th></tr></thead><tbody>${products
    .map(
      (p) =>
        `<tr><td>${esc(p.product_type)}</td><td>${esc(p.sl_no)}</td><td>${esc(
          p.brand
        )}</td><td>${esc(p.model_name)}</td><td>${esc(
          p.model_number
        )}</td><td>${esc(p.status)}</td><td>${esc(
          p.problem_reported
        )}</td></tr>`
    )
    .join("")}${
      products.length < 1 ? '<tr><td colspan="7">&nbsp;</td></tr>' : ""
    }</tbody></table>
  <div class="amounts"><span>Service Amount : ${money(
    serviceAmount
  )}</span><span>Advance Paid : ${money(
      advance
    )}</span><strong>Balance : ${money(balance)}</strong></div>
  
${
  hpTemplate
    ? hpTemplate.termsTitleHtml
    : '<div class="terms-title">Terms and conditions :</div>'
}

<ol class="terms">
  ${
    hpTemplate
      ? hpTemplate.termsHtml
      : terms.map((t) => `<li>${esc(t)}</li>`).join("") ||
        "<li>Terms &amp; Conditions have not been configured in Service Job Settings.</li>"
  }
</ol>

  <footer class="footer"><div class="footer-date">Date : ${date(
    new Date()
  )}</div><div class="signatures"><div class="frontdesk-area">${
      c.companySealUrl
        ? `<img src="${esc(c.companySealUrl)}" alt="Company seal">`
        : ""
    }<div class="frontdesk-caption">Signature of Front Desk :</div></div><div class="signature">Signature of Customer :</div></div></footer></main><script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  }

  function exportExcel() {
    const cols = [
      "job_sheet_no",
      "job_date",
      "customer_name",
      "mobile",
      "model_name",
      "model_number",
      "status",
      "engineer_name",
      "move_to",
    ];
    const rows = [
      cols.join(","),
      ...filteredJobs.map((j) =>
        cols
          .map((k) => `"${String(j[k] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob(["\ufeff" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Service-Jobs.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const filteredJobs = jobs.filter(
    (j) => moveFilter === "All" || j.move_to === moveFilter
  );
  const settingKey = {
    product_type: "Product Type",
    brand: "Brand",
    status: "Status",
    move_to: "Move To",
    billing_type: "Billing Type",
  };
  return (
    <main className="content">
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">Service Jobs</h1>
          <p className="muted">Create and track customer service jobs.</p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn"
            style={{ background: "#06b15b", color: "#fff" }}
            onClick={exportExcel}
          >
            <Download size={16} /> Export Excel
          </button>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => start()}>
              <Plus size={16} /> Create Service Job
            </button>
          )}
        </div>
      </div>
      <section className="card">
        <div
          className="toolbar-actions"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div className="field">
            <label>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label>To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Search</label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: 10, top: 12 }}
              />
              <input
                style={{ paddingLeft: 34 }}
                placeholder="Search Job No, customer, mobile, model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <strong>Filter :</strong>
          {filters.map((x) => (
            <label
              key={x}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="service-job-filter"
                checked={moveFilter === x}
                onChange={() => setMoveFilter(x)}
              />
              {x}
            </label>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Date",
                  "Job Sheet No.",
                  "Service No.",
                  "Model",
                  "Model Name",
                  "Customer Name",
                  "Move To",
                  "Actions",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    {j.job_date
                      ? new Date(j.job_date).toLocaleDateString("en-GB")
                      : ""}
                  </td>
                  <td>{j.job_sheet_no}</td>
                  <td>{j.service_no}</td>
                  <td>{j.model_number}</td>
                  <td>{j.model_name}</td>
                  <td>{j.customer_name}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 9px",
                        borderRadius: 12,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        background: statusColors[j.move_to] || "#64748b",
                      }}
                    >
                      {j.move_to || "Open"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        onClick={() => printJob(j)}
                        title="Print Job Report"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => start(j)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {canDelete && (
                        <button
                          className="icon-button danger-button"
                          onClick={() => setConfirm(j)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredJobs.length && (
                <tr>
                  <td colSpan="8" className="empty-state">
                    No service jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            className="card item-modal"
            style={{ maxWidth: 1050, maxHeight: "92vh", overflowY: "auto" }}
          >
            <div className="modal-heading">
              <div>
                <h2 className="section-heading">
                  {editId ? "Edit Service Job" : "Create New Job Sheet"}
                </h2>
                <p className="muted">
                  Job Sheet No.:{" "}
                  {editId
                    ? form.job_sheet_no
                    : `${meta.prefix} (automatically assigned on save)`}
                </p>
                <small className="muted">Fields marked * are required.</small>
              </div>
              <button className="icon-button" onClick={() => setModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save} noValidate>
              <div
                className="field"
                style={{ position: "relative", marginBottom: 14 }}
              >
                <label>Search Customer *</label>
                <div style={{ position: "relative" }}>
                  <input
                    value={customerSearch}
                    placeholder="Type customer name, mobile or GSTIN..."
                    autoComplete="off"
                    aria-expanded={customerListOpen}
                    aria-controls="service-job-customer-options"
                    onFocus={() => {
                      setCustomerListOpen(true);
                      setActiveCustomerIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (
                        !customerListOpen &&
                        ["ArrowDown", "ArrowUp"].includes(e.key)
                      ) {
                        setCustomerListOpen(true);
                        setActiveCustomerIndex(0);
                        e.preventDefault();
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveCustomerIndex((i) =>
                          Math.min(
                            i + 1,
                            Math.max(visibleCustomers.length - 1, 0)
                          )
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveCustomerIndex((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter" && customerListOpen) {
                        e.preventDefault();
                        if (visibleCustomers[activeCustomerIndex])
                          chooseCustomer(visibleCustomers[activeCustomerIndex]);
                      } else if (e.key === "Escape") {
                        setCustomerListOpen(false);
                      }
                    }}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerListOpen(true);
                      setActiveCustomerIndex(0);
                      setForm((v) => ({
                        ...v,
                        customer_id: "",
                        customer_name: "",
                      }));
                    }}
                  />
                  {customerListOpen && (
                    <div
                      id="service-job-customer-options"
                      role="listbox"
                      style={{
                        position: "absolute",
                        zIndex: 1000,
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        maxHeight: 220,
                        overflowY: "auto",
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        boxShadow: "0 8px 20px rgba(0,0,0,.16)",
                      }}
                    >
                      {visibleCustomers.map((c, i) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={activeCustomerIndex === i}
                          data-customer-option={i}
                          key={c.id}
                          onMouseEnter={() => setActiveCustomerIndex(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => chooseCustomer(c)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 12px",
                            border: 0,
                            borderBottom: "1px solid #eee",
                            background:
                              activeCustomerIndex === i ? "#6b7280" : "#fff",
                            color:
                              activeCustomerIndex === i ? "#fff" : "#111827",
                            cursor: "pointer",
                          }}
                        >
                          {c.customer_name}{" "}
                          <span
                            style={{
                              color:
                                activeCustomerIndex === i ? "#fff" : "#64748b",
                            }}
                          >
                            {" "}
                            - {c.mobile || ""}
                          </span>
                        </button>
                      ))}
                      {!visibleCustomers.length && (
                        <div style={{ padding: 12, color: "#64748b" }}>
                          No matching customers.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <small className="muted">
                  Select a customer from the suggestions, or add a new customer.
                </small>
                {errors.customer_id && (
                  <small style={{ color: "#dc3545", display: "block" }}>
                    {errors.customer_id}
                  </small>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setCustomerListOpen(false);
                    setCustomerOpen(true);
                  }}
                >
                  <UserPlus size={16} /> New Customer
                </button>
              </div>
              <div
                className="field"
                style={{ maxWidth: 360, marginBottom: 14 }}
              >
                <label>Job Date *</label>
                <input
                  type="date"
                  value={form.job_date || ""}
                  required
                  onChange={(e) => {
                    setForm((v) => ({ ...v, job_date: e.target.value }));
                    setErrors((v) => ({ ...v, job_date: "" }));
                  }}
                />
                {errors.job_date && (
                  <small style={{ color: "#dc3545" }}>{errors.job_date}</small>
                )}
              </div>
              <div
                className="card"
                style={{
                  padding: 14,
                  border: "1px solid #d1d5db",
                  marginBottom: 14,
                }}
              >
                <div className="field">
                  <label>Service Type</label>
                  <div className="radio-group">
                    {(
                      meta.settings["Service Type"] || [
                        "Carry In",
                        "Pick Up",
                        "On Site",
                      ]
                    ).map((x) => (
                      <label key={x}>
                        <input
                          type="radio"
                          checked={form.service_type === x}
                          onChange={() =>
                            setForm((v) => ({ ...v, service_type: x }))
                          }
                        />{" "}
                        {x}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <section
                className="card"
                style={{ margin: "14px 0", padding: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <h3 className="section-heading">
                    Product Information (maximum 3)
                  </h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={(form.products || []).length >= 3}
                    onClick={() =>
                      setForm((v) => ({
                        ...v,
                        products: [...(v.products || []), blankProduct()],
                      }))
                    }
                  >
                    <Plus size={15} /> Add Product
                  </button>
                </div>
                {(form.products || []).map((product, index) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <strong>Product {index + 1}</strong>
                      {(form.products || []).length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() =>
                            setForm((v) => ({
                              ...v,
                              products: v.products.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="form-grid item-form-grid">
                      {[
                        ["product_type", "Product", "select"],
                        ["sl_no", "Sl No."],
                        ["brand", "Brand", "select"],
                        ["model_name", "Model"],
                        ["model_number", "Model No."],
                        ["status", "Product Status", "select"],
                        ["problem_reported", "Reported Fault", "textarea"],
                      ].map(([key, label, type]) => (
                        <div className="field" key={key}>
                          <label>{label}</label>
                          {type === "select" ? (
                            <select
                              value={product[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  products: v.products.map((p, i) =>
                                    i === index
                                      ? { ...p, [key]: e.target.value }
                                      : p
                                  ),
                                }))
                              }
                            >
                              <option value="">-SELECT-</option>
                              {(
                                meta.settings[
                                  key === "product_type"
                                    ? "Product Type"
                                    : key === "brand"
                                    ? "Brand"
                                    : "Status"
                                ] || []
                              ).map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                            </select>
                          ) : type === "textarea" ? (
                            <textarea
                              rows={2}
                              value={product[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  products: v.products.map((p, i) =>
                                    i === index
                                      ? { ...p, [key]: e.target.value }
                                      : p
                                  ),
                                }))
                              }
                            />
                          ) : (
                            <input
                              value={product[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  products: v.products.map((p, i) =>
                                    i === index
                                      ? { ...p, [key]: e.target.value }
                                      : p
                                  ),
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
              {sections.map(([title, fields]) => (
                <section
                  className="card"
                  key={title}
                  style={{ margin: "14px 0", padding: 16 }}
                >
                  <h3 className="section-heading">{title}</h3>
                  <div className="form-grid item-form-grid">
                    {fields
                      .filter(([key]) => key !== "customer_name")
                      .map(([key, label, type]) => (
                        <div className="field" key={key}>
                          <label>{label}</label>
                          {type === "select" ? (
                            <select
                              value={form[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  [key]: e.target.value,
                                }))
                              }
                            >
                              <option value="">-SELECT-</option>
                              {(meta.settings[settingKey[key]] || []).map(
                                (v) => (
                                  <option key={v}>{v}</option>
                                )
                              )}
                            </select>
                          ) : type === "textarea" ? (
                            <textarea
                              rows={4}
                              value={form[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          ) : type === "engineer" ? (
                            <select
                              value={form[key] || ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  [key]: e.target.value,
                                }))
                              }
                            >
                              <option value="">-SELECT-</option>
                              {meta.engineers.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                type === "number"
                                  ? "number"
                                  : type === "date"
                                  ? "date"
                                  : "text"
                              }
                              min={type === "number" ? 0 : undefined}
                              value={form[key] ?? ""}
                              onChange={(e) =>
                                setForm((v) => ({
                                  ...v,
                                  [key]:
                                    type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              ))}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={busy}>
                  {busy
                    ? "Saving..."
                    : editId
                    ? "Update Service Job"
                    : "Save Service Job"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <CustomerModal
        isOpen={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSaved={chooseCustomer}
      />
      <ConfirmModal
        open={!!confirm}
        title="Delete Service Job"
        message={`Delete job sheet ${confirm?.job_sheet_no || ""}?`}
        confirmText="Delete"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </main>
  );
}
