import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  // Company admins can create operational accounts, but cannot grant admin access here.
  role: z.enum(["engineer", "staff"])
});

async function getActiveAdmin() {
  const session = await getSession();
  if (!session) return { error: "Authentication required.", status: 401 };

  await connectDB();
  // Check current database role and active status; do not trust token role alone.
  const admin = await User.findOne({
    _id: session.userId,
    companyId: session.companyId,
    role: "admin",
    isActive: true
  }).select("_id companyId").lean();

  if (!admin) return { error: "Only a company admin can manage users.", status: 403 };
  return { session, admin };
}

export async function GET() {
  try {
    const authorization = await getActiveAdmin();
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const users = await User.find({ companyId: authorization.session.companyId })
      .select("fullName username email role isActive createdAt")
      .sort({ createdAt: 1 }).lean();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("List users failed:", error);
    return NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authorization = await getActiveAdmin();
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the user details and password requirements.", details: parsed.error.flatten() }, { status: 400 });
    }

    const { password, ...safeInput } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    // The company ID always comes from the verified session, never the request body.
    const user = await User.create({
      ...safeInput,
      companyId: authorization.session.companyId,
      passwordHash,
      isActive: true
    });

    return NextResponse.json({
      message: "User created successfully.",
      user: {
        id: String(user._id), fullName: user.fullName,
        username: user.username, email: user.email, role: user.role,
        isActive: user.isActive
      }
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "That username or email is already used in this company." }, { status: 409 });
    }
    console.error("Create user failed:", error);
    return NextResponse.json({ error: "Unable to create user." }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["engineer", "staff"]),
  password: z.string().max(128).optional().or(z.literal(""))
});

export async function PUT(request) {
  try {
    const authorization = await getActiveAdmin();
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const parsed = updateUserSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the user details. Password must contain at least 12 characters when changing it." }, { status: 400 });
    const { id, password, ...changes } = parsed.data;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
    if (password && password.length < 12) return NextResponse.json({ error: "Password must contain at least 12 characters." }, { status: 400 });
    const user = await User.findOne({ _id: id, companyId: authorization.session.companyId, role: { $ne: "admin" } });
    if (!user) return NextResponse.json({ error: "User not found or admin accounts cannot be changed here." }, { status: 404 });
    Object.assign(user, changes);
    if (password) user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();
    return NextResponse.json({ message: "User details updated successfully.", user: { id: String(user._id), fullName: user.fullName, username: user.username, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "That username or email is already used in this company." }, { status: 409 });
    console.error("Update user failed:", error);
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authorization = await getActiveAdmin();
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const { id, isActive } = await request.json();
    if (!mongoose.isValidObjectId(id) || typeof isActive !== "boolean") return NextResponse.json({ error: "Select a valid user and status." }, { status: 400 });
    const user = await User.findOne({ _id: id, companyId: authorization.session.companyId, role: { $ne: "admin" } });
    if (!user) return NextResponse.json({ error: "User not found or admin accounts cannot be changed here." }, { status: 404 });
    user.isActive = isActive;
    await user.save();
    return NextResponse.json({ message: isActive ? "User activated." : "User made inactive.", user: { id: String(user._id), fullName: user.fullName, username: user.username, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (error) {
    console.error("Change user status failed:", error);
    return NextResponse.json({ error: "Unable to change user status." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authorization = await getActiveAdmin();
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const id = new URL(request.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
    const result = await User.deleteOne({ _id: id, companyId: authorization.session.companyId, role: { $ne: "admin" } });
    if (!result.deletedCount) return NextResponse.json({ error: "User not found or admin accounts cannot be deleted here." }, { status: 404 });
    return NextResponse.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete user failed:", error);
    return NextResponse.json({ error: "Unable to delete user." }, { status: 500 });
  }
}
