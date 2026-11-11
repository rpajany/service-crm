import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import CompanyProfileForm from "./profile-form";

export const metadata = { title: "Company Profile | Hardware Service CRM" };

export default async function CompanyProfilePage() {
  const session = await getSession();
  await connectDB();

  // Find the company only by the company ID from the verified session.
  const company = await Company.findById(session.companyId)
    .select("name slug email phone address website gstNumber logoUrl companySealUrl status")
    .lean();

  if (!company || company.status !== "active") redirect("/login");

  return (
    <main className="content">
      <p className="muted" style={{ marginTop: 0 }}>Workspace settings</p>
      <h1 className="page-title">Company Profile</h1>
      <p className="muted">Manage your business contact information.</p>
      {session.role === "admin" ? (
        <CompanyProfileForm company={JSON.parse(JSON.stringify(company))} />
      ) : (
        <section className="card">
          <h2 className="section-heading">{company.name}</h2>
          <p className="muted">Only a company admin can edit this profile.</p>
        </section>
      )}
    </main>
  );
}
