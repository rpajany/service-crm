import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  try {
    await connectDB();
    const user = await User.findOne({
      _id: session.userId,
      companyId: session.companyId,
      isActive: true
    }).select("fullName username email role companyId").lean();

    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    const company = await Company.findOne({
      _id: user.companyId,
      status: "active"
    }).select("name slug").lean();

    if (!company) return NextResponse.json({ user: null }, { status: 401 });

    return NextResponse.json({
      user: {
        id: String(user._id),
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role
      },
      company: { name: company.name, slug: company.slug }
    });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ error: "Unable to verify session." }, { status: 500 });
  }
}
