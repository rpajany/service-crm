"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogIn } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ companySlug: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark"><Laptop size={23} /></div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Welcome back</h1>
        <p className="muted" style={{ marginTop: 0 }}>Sign in to your hardware service workspace.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="companySlug">Company code</label>
          <input id="companySlug" name="companySlug" value={form.companySlug} onChange={update} placeholder="e.g. abc-computer-services" required autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" value={form.username} onChange={update} required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" value={form.password} onChange={update} required autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-full" disabled={busy} type="submit">
          <LogIn size={17} /> {busy ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
          New deployment? Use the protected setup page to register the first company.
        </p>
      </form>
    </main>
  );
}
