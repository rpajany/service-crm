import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  // Route signed-in users to the dashboard and visitors to login.
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
