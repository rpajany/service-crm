import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";
import { loginSchema } from "@/lib/validation";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your company code, username, and password." }, { status: 400 });
    }

    const { companySlug, username, password } = parsed.data;
    await connectDB();

    const company = await Company.findOne({ slug: companySlug, status: "active" })
      .select("_id").lean();

    // Use a generic error so the endpoint doesn't disclose which field was wrong.
    if (!company) {
      return NextResponse.json({ error: "Invalid company code or login credentials." }, { status: 401 });
    }

    const user = await User.findOne({
      companyId: company._id,
      username,
      isActive: true
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid company code or login credentials." }, { status: 401 });
    }

    const token = await createSessionToken(user);
    const response = NextResponse.json({ message: "Signed in successfully." });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
