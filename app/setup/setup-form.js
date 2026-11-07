"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

const initial = {
  setupKey: "",
  company: {
    name: "", slug: "", email: "", phone: "",
    address: { street: "", city: "", state: "", postalCode: "", country: "" },
    website: "", gstNumber: ""
  },
  admin: { fullName: "", username: "", email: "", password: "" }
};

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function setCompany(name, value) {
    setForm((current) => ({ ...current, company: { ...current.company, [name]: value } }));
  }

  function setAddress(name, value) {
    setForm((current) => ({
      ...current,
      company: {
        ...current.company,
        address: { ...current.company.address, [name]: value }
      }
    }));
  }

  function setAdmin(name, value) {
    setForm((current) => ({ ...current, admin: { ...current.admin, [name]: value } }));
  }

  function slugFromName(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Company setup failed.");

      // Automatically sign in after creating the first company/admin.
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err.message || "Company setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" style={{ width: "min(100%, 760px)" }} onSubmit={submit}>
        <div className="brand-mark"><Building2 size={23} /></div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Company onboarding</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Create a company and its first admin. Keep your setup key private.
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="setupKey">Onboarding setup key *</label>
          <input id="setupKey" type="password" value={form.setupKey} onChange={(e) => setForm((c) => ({ ...c, setupKey: e.target.value }))} required autoComplete="off" />
        </div>

        <h2 className="section-heading" style={{ marginTop: 22 }}>Company details</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="company-name">Company name *</label>
            <input id="company-name" value={form.company.name} onChange={(e) => {
              const name = e.target.value;
              setForm((c) => ({
                ...c,
                company: {
                  ...c.company,
                  name,
                  // Generate a slug automatically, which the user can edit below.
                  slug: c.company.slug ? c.company.slug : slugFromName(name)
                }
              }));
            }} required maxLength={150} />
          </div>
          <div className="field">
            <label htmlFor="company-slug">Company code / slug *</label>
            <input id="company-slug" value={form.company.slug} onChange={(e) => setCompany("slug", slugFromName(e.target.value))} required maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="company-email">Business email *</label>
            <input id="company-email" type="email" value={form.company.email} onChange={(e) => setCompany("email", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="company-phone">Business phone *</label>
            <input id="company-phone" value={form.company.phone} onChange={(e) => setCompany("phone", e.target.value)} required maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="company-website">Website</label>
            <input id="company-website" type="url" value={form.company.website} onChange={(e) => setCompany("website", e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="field">
            <label htmlFor="company-gst">GST number</label>
            <input id="company-gst" value={form.company.gstNumber} onChange={(e) => setCompany("gstNumber", e.target.value)} maxLength={50} />
          </div>
        </div>

        <h2 className="section-heading" style={{ marginTop: 18 }}>Address</h2>
        <div className="form-grid">
          {[
            ["street", "Street address"], ["city", "City"], ["state", "State / region"],
            ["postalCode", "Postal code"], ["country", "Country"]
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`address-${key}`}>{label}</label>
              <input id={`address-${key}`} value={form.company.address[key]} onChange={(e) => setAddress(key, e.target.value)} />
            </div>
          ))}
        </div>

        <h2 className="section-heading" style={{ marginTop: 18 }}>First company admin</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="admin-name">Full name *</label>
            <input id="admin-name" value={form.admin.fullName} onChange={(e) => setAdmin("fullName", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="admin-username">Username *</label>
            <input id="admin-username" value={form.admin.username} onChange={(e) => setAdmin("username", e.target.value.toLowerCase())} required minLength={3} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="admin-email">Admin email *</label>
            <input id="admin-email" type="email" value={form.admin.email} onChange={(e) => setAdmin("email", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password * (minimum 12 characters)</label>
            <input id="admin-password" type="password" value={form.admin.password} onChange={(e) => setAdmin("password", e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
          </div>
        </div>

        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? "Creating company..." : "Create company and admin"}
        </button>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          This endpoint requires the server-side BOOTSTRAP_SECRET and is intended for controlled onboarding.
          Do not publish the setup key or leave a weak key configured in production.
        </p>
      </form>
    </main>
  );
}
