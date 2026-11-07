"use client";

import { useState } from "react";
import { INDIAN_STATES, getIndianStateLabel } from "@/lib/indian-states";

const MAX_LOGO_BYTES = 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function CompanyProfileForm({ company }) {
  const [form, setForm] = useState({
    name: company.name || "",
    email: company.email || "",
    phone: company.phone || "",
    address: {
      street: company.address?.street || "",
      city: company.address?.city || "",
      state: getIndianStateLabel(company.address?.state),
      postalCode: company.address?.postalCode || "",
      country: company.address?.country || ""
    },
    website: company.website || "",
    gstNumber: company.gstNumber || "",
    logoUrl: company.logoUrl || "",
    companySealUrl: company.companySealUrl || ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [sealError, setSealError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setForm((current) => ({
        ...current,
        address: { ...current.address, [key]: value }
      }));
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    setLogoError("");
    setMessage("");
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Choose a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo image must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setLogoError("Could not read this image. Please try another file.");
        return;
      }
      setForm((current) => ({ ...current, logoUrl: reader.result }));
      setLogoError("");
    };
    reader.onerror = () => setLogoError("Could not read this image. Please try another file.");
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleSealUpload(event) {
    const file = event.target.files?.[0];
    setSealError(""); setMessage("");
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) { setSealError("Choose a PNG, JPEG, or WebP image."); event.target.value = ""; return; }
    if (file.size > MAX_LOGO_BYTES) { setSealError("Company seal image must be 1 MB or smaller."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result !== "string") { setSealError("Could not read this image."); return; } setForm((current) => ({ ...current, companySealUrl: reader.result })); };
    reader.onerror = () => setSealError("Could not read this image. Please try another file.");
    reader.readAsDataURL(file); event.target.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save profile.");
      setMessage("Company profile saved successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 900, marginTop: 22 }}>
      <h2 className="section-heading">Business details</h2>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Company name *</label>
          <input id="name" name="name" value={form.name} onChange={updateField} required maxLength={150} />
        </div>
        <div className="field">
          <label htmlFor="email">Business email *</label>
          <input id="email" name="email" type="email" value={form.email} onChange={updateField} required />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone *</label>
          <input id="phone" name="phone" value={form.phone} onChange={updateField} required maxLength={30} />
        </div>
        <div className="field">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="url" value={form.website} onChange={updateField} placeholder="https://example.com" />
        </div>
        <div className="field">
          <label htmlFor="gstNumber">GST number</label>
          <input id="gstNumber" name="gstNumber" value={form.gstNumber} onChange={updateField} maxLength={50} />
        </div>
        <div className="field">
          <label htmlFor="logo-upload">Company logo image (optional)</label>
          <input
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoUpload}
            aria-describedby="logo-help"
          />
          <small id="logo-help">PNG, JPEG, or WebP. Maximum file size: 1 MB.</small>
          {logoError && <div className="alert alert-error" role="alert">{logoError}</div>}
          {form.logoUrl && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <img
                src={form.logoUrl}
                alt="Company logo preview"
                style={{ maxWidth: 180, maxHeight: 100, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, padding: 6 }}
              />
              <button
                className="btn"
                type="button"
                onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))}
              >Remove logo</button>
            </div>
          )}
          <details style={{ marginTop: 10 }}>
            <summary>Use an existing logo URL instead</summary>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
              onChange={updateField}
              placeholder="https://..."
              style={{ marginTop: 8 }}
            />
          </details>
        </div>
        <div className="field">
          <label htmlFor="company-seal-upload">Company seal image (optional)</label>
          <input id="company-seal-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSealUpload} aria-describedby="seal-help" />
          <small id="seal-help">PNG, JPEG, or WebP. Maximum file size: 1 MB. Stored with the company profile.</small>
          {sealError && <div className="alert alert-error" role="alert">{sealError}</div>}
          {form.companySealUrl && <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><img src={form.companySealUrl} alt="Company seal preview" style={{ maxWidth: 180, maxHeight: 120, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, padding: 6 }} /><button className="btn" type="button" onClick={() => setForm((current) => ({ ...current, companySealUrl: "" }))}>Remove seal</button></div>}
        </div>
      </div>

      <h2 className="section-heading" style={{ marginTop: 18 }}>Business address</h2>
      <div className="form-grid">
        {[
          ["street", "Street address"],
          ["city", "City"],
          ["state", "State / region"],
          ["postalCode", "Postal code"],
          ["country", "Country"]
        ].map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`address-${key}`}>{label}</label>
            {key === "state" ? (
              <select id={`address-${key}`} name={`address.${key}`} value={form.address[key]} onChange={updateField}>
                <option value="">-Select-</option>
                {INDIAN_STATES.map((state) => <option key={state.value} value={state.label}>{state.label}</option>)}
              </select>
            ) : (
              <input id={`address-${key}`} name={`address.${key}`} value={form.address[key]} onChange={updateField} />
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save company profile"}
      </button>
    </form>
  );
}
