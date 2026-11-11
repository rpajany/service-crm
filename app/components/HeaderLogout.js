"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function HeaderLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setBusy(false);
    }
  }

  return (
    <button type="button" className="header-logout" onClick={handleLogout} disabled={busy}>
      <LogOut size={17} />
      <span>{busy ? "Signing out..." : "Logout"}</span>
    </button>
  );
}
