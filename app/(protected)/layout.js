import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import Sidebar from "@/app/components/Sidebar";
import ToastProvider from "@/app/components/common/ToastProvider";
import HeaderLogout from "@/app/components/HeaderLogout";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }) {
  const session = await getSession();

  // No valid session means this page must not render.
  if (!session) redirect("/login");

  await connectDB();

  // Reload current user and company status from MongoDB.
  // This ensures a deactivated user or suspended company cannot rely only
  // on old role/company claims stored in a still-valid token.
  const user = await User.findOne({
    _id: session.userId,
    companyId: session.companyId,
    isActive: true
  }).select("fullName username role companyId").lean();

  if (!user) redirect("/login");

  // Enforce admin-only pages using the current database role as well as the signed session.
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-protected-pathname") || "";
  const adminOnlyPaths = ["/company-profile", "/settings", "/users"];
  if (
    adminOnlyPaths.some((path) => currentPath === path || currentPath.startsWith(`${path}/`)) &&
    user.role !== "admin"
  ) {
    redirect("/dashboard");
  }

  const company = await Company.findOne({
    _id: user.companyId,
    status: "active"
  }).select("name").lean();

  if (!company) redirect("/login");

  const safeUser = {
    fullName: user.fullName,
    username: user.username,
    role: user.role
  };

  return (
    <ToastProvider><div className="app-shell">
      <Sidebar user={safeUser} />
      <div className="main-shell">
        <header className="topbar">
          <div>
            <strong>{company.name}</strong>
            <div className="muted" style={{ fontSize: 12 }}>Hardware Service CRM</div>
          </div>
          <div className="topbar-actions">
            <div className="muted topbar-user">{safeUser.fullName} · {safeUser.role}</div>
            <HeaderLogout />
          </div>
        </header>
        {children}
      </div>
    </div></ToastProvider>
  );
}
