import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import UsersManager from "./users-manager";

export const metadata = { title: "Users & Roles | Hardware Service CRM" };

export default async function UsersPage() {
  const session = await getSession();
  await connectDB();

  // Only fetch users belonging to the current company.
  const users = await User.find({ companyId: session.companyId })
    .select("fullName username email role isActive createdAt")
    .sort({ createdAt: 1 }).lean();

  const safeUsers = users.map((user) => ({
    id: String(user._id), fullName: user.fullName, username: user.username,
    email: user.email, role: user.role, isActive: user.isActive
  }));

  return <UsersManager initialUsers={safeUsers} canManage={session.role === "admin"} />;
}
