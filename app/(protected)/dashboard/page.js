import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";

export const metadata = { title: "Dashboard | Hardware Service CRM" };

export default async function DashboardPage() {
  const session = await getSession();

  // Guard this page too: never access session claims until a valid session exists.
  // The protected layout also checks authentication, but this keeps the page safe
  // if it is rendered independently or the session expires between requests.
  if (!session) redirect("/login");

  await connectDB();

  // Every query is scoped to the authenticated company ID.
  const [company, userCount] = await Promise.all([
    Company.findOne({ _id: session.companyId, status: "active" })
      .select("name slug email phone createdAt").lean(),
    User.countDocuments({ companyId: session.companyId })
  ]);

  return (
    <main className="content">
      <p className="muted" style={{ marginTop: 0 }}>Overview</p>
      <h1 className="page-title">Dashboard</h1>
      <p className="muted">Welcome back. Your workspace is ready.</p>

      <div className="stat-grid">
        <section className="card">
          <div className="muted">Company</div>
          <div className="stat-number" style={{ fontSize: 22 }}>{company?.name || "—"}</div>
          <p className="muted" style={{ fontSize: 13 }}>Your active workspace</p>
        </section>
        <section className="card">
          <div className="muted">Team members</div>
          <div className="stat-number">{userCount}</div>
          <p className="muted" style={{ fontSize: 13 }}>Users in your company</p>
        </section>
        <section className="card">
          <div className="muted">Your role</div>
          <div className="stat-number" style={{ textTransform: "capitalize" }}>{session.role}</div>
          <p className="muted" style={{ fontSize: 13 }}>Access is checked on the server</p>
        </section>
      </div>

      <section className="card">
        <h2 className="section-heading">Getting started</h2>
        <p className="muted">
          Update your company profile and review your team. Service jobs and inventory
          will be implemented in a later version.
        </p>
      </section>
    </main>
  );
}
