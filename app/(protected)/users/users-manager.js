"use client";

import { useState } from "react";
import { Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import ConfirmModal from "@/app/components/common/ConfirmModal";

const emptyForm = { fullName: "", username: "", email: "", password: "", role: "staff" };

export default function UsersManager({ initialUsers, canManage }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function startEdit(user) {
    setEditing(user);
    setForm({ fullName: user.fullName, username: user.username, email: user.email, password: "", role: user.role });
    setError(""); setMessage("");
  }
  function resetForm() { setEditing(null); setForm(emptyForm); }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/users", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save user.");
      if (editing) setUsers((current) => current.map((user) => user.id === data.user.id ? data.user : user));
      else setUsers((current) => [...current, data.user]);
      setMessage(data.message || (editing ? "User updated." : "User created.")); resetForm();
    } catch (err) { setError(err.message || "Unable to save user."); }
    finally { setBusy(false); }
  }

  async function toggleActive(user) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, isActive: !user.isActive }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to change user status.");
      setUsers((current) => current.map((entry) => entry.id === user.id ? data.user : entry)); setMessage(data.message);
    } catch (err) { setError(err.message || "Unable to change user status."); }
    finally { setBusy(false); }
  }

  async function deleteUser() {
    if (!confirmDelete) return; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/users?id=${encodeURIComponent(confirmDelete.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to delete user.");
      setUsers((current) => current.filter((entry) => entry.id !== confirmDelete.id)); setConfirmDelete(null); setMessage(data.message);
      if (editing?.id === confirmDelete.id) resetForm();
    } catch (err) { setError(err.message || "Unable to delete user."); }
    finally { setBusy(false); }
  }

  return (
    <main className="content">
      <p className="muted" style={{ marginTop: 0 }}>Team management</p>
      <h1 className="page-title">Users & Roles</h1>
      <p className="muted">Manage company team accounts, roles, passwords and access status.</p>

      {canManage && <form className="card" onSubmit={submit} style={{ marginTop: 22, maxWidth: 900 }}>
        <h2 className="section-heading">{editing ? `Edit ${editing.fullName}` : "Create a team member"}</h2>
        <p className="muted" style={{ fontSize: 13 }}>{editing ? "Leave the password blank to keep the existing password." : "Create engineer and staff accounts. Admin accounts are protected from changes here."}</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {message && <div className="alert alert-success" role="status">{message}</div>}
        <div className="form-grid">
          <div className="field"><label htmlFor="fullName">Full name *</label><input id="fullName" name="fullName" value={form.fullName} onChange={update} required minLength={2} maxLength={120} /></div>
          <div className="field"><label htmlFor="username">Username *</label><input id="username" name="username" value={form.username} onChange={update} required minLength={3} autoComplete="off" /></div>
          <div className="field"><label htmlFor="email">Email *</label><input id="email" name="email" type="email" value={form.email} onChange={update} required /></div>
          <div className="field"><label htmlFor="password">{editing ? "New password (optional)" : "Temporary password *"}</label><input id="password" name="password" type="password" value={form.password} onChange={update} required={!editing} minLength={12} maxLength={128} autoComplete="new-password" placeholder="At least 12 characters" /></div>
          <div className="field"><label htmlFor="role">Role *</label><select id="role" name="role" value={form.role} onChange={update}><option value="staff">Staff</option><option value="engineer">Engineer</option></select></div>
        </div>
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Update User" : "Create User"}</button>{editing && <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={busy}>Cancel Edit</button>}</div>
      </form>}

      {!canManage && <div className="alert alert-error" style={{ marginTop: 22 }}>Only company admins can manage users.</div>}

      <section className="card" style={{ marginTop: 22, overflowX: "auto" }}>
        <h2 className="section-heading">Company team</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead><tr>{["Name", "Username", "Email", "Role", "Status", "Actions"].map((heading) => <th key={heading} style={{ padding: 12, borderBottom: "1px solid #e4e7ec", fontSize: 13 }}>{heading}</th>)}</tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5" }}>{user.fullName}</td>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5" }}>{user.username}</td>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5" }}>{user.email}</td>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5", textTransform: "capitalize" }}>{user.role}</td>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5" }}>{user.isActive ? "Active" : "Inactive"}</td>
            <td style={{ padding: 12, borderBottom: "1px solid #f0f2f5" }}><div className="row-actions">
              {canManage && user.role !== "admin" && <><button className="icon-button" type="button" title="Edit user" onClick={() => startEdit(user)}><Pencil size={16} /></button><button className="icon-button" type="button" title={user.isActive ? "Make inactive" : "Activate user"} disabled={busy} onClick={() => toggleActive(user)}>{user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}</button><button className="icon-button danger-button" type="button" title="Delete user" onClick={() => setConfirmDelete(user)}><Trash2 size={16} /></button></>}
              {user.role === "admin" && <span className="muted">Protected</span>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </section>
      <ConfirmModal open={!!confirmDelete} title="Delete User" message={`Permanently delete ${confirmDelete?.fullName || "this user"}? The user will no longer be able to sign in.`} confirmText="Delete User" busy={busy} onCancel={() => setConfirmDelete(null)} onConfirm={deleteUser} />
    </main>
  );
}
