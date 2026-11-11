import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";
import { companyOnboardingSchema, formatValidationDetails } from "@/lib/validation";
import { isDuplicateKeyError } from "@/lib/http";

export const runtime = "nodejs";

// Controlled onboarding: require a server-only secret and validate all input.
export async function POST(request) {
  let company = null;

  try {
    const body = await request.json();
    const parsed = companyOnboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the submitted fields.", details: formatValidationDetails(parsed.error) },
        { status: 400 }
      );
    }

    const { setupKey, company: companyInput, admin } = parsed.data;
    const expectedKey = process.env.BOOTSTRAP_SECRET;

    if (!expectedKey || expectedKey.length < 32) {
      return NextResponse.json(
        { error: "Company onboarding is not configured on the server." },
        { status: 503 }
      );
    }

    // Compare fixed-length hashes to avoid a simple early-exit string comparison.
    const suppliedHash = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(setupKey).digest()
    );
    const expectedHash = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(expectedKey).digest()
    );
    const { timingSafeEqual } = await import("node:crypto");
    if (!timingSafeEqual(suppliedHash, expectedHash)) {
      return NextResponse.json({ error: "Invalid onboarding key." }, { status: 403 });
    }

    await connectDB();

    // Avoid accidental duplicate company registration.
    const existing = await Company.findOne({ slug: companyInput.slug }).select("_id").lean();
    if (existing) {
      return NextResponse.json({ error: "That company code is already registered." }, { status: 409 });
    }

    // Hash the password before it ever reaches the database.
    const passwordHash = await bcrypt.hash(admin.password, 12);

    // MongoDB transactions make the company and its first admin an all-or-nothing
    // operation. Transactions require a replica set (or a sharded cluster).
    // Many local MongoDB installations run as a standalone server, so detect that
    // setup and use a best-effort rollback there instead of making local onboarding fail.
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    const supportsTransactions = topologyType !== "Single";

    const createAdmin = (companyId, session) => User.create(
      [{
        companyId,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        passwordHash,
        role: "admin",
        isActive: true
      }],
      // Mongoose needs the session option so this write participates in the transaction.
      session ? { session } : undefined
    );

    if (supportsTransactions) {
      // On replica-set / sharded MongoDB, both writes commit together or neither does.
      // withTransaction also handles transient transaction errors according to MongoDB's rules.
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const [createdCompany] = await Company.create([companyInput], { session });
          company = createdCompany;
          await createAdmin(createdCompany._id, session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Compatibility mode for local standalone MongoDB: transactions are unavailable.
      // If admin creation fails, delete the company we just made. This is best-effort
      // cleanup, not strict atomicity (a process crash can interrupt the cleanup).
      company = await Company.create(companyInput);
      try {
        await createAdmin(company._id, null);
      } catch (userError) {
        try {
          await Company.deleteOne({ _id: company._id });
          company = null;
        } catch (rollbackError) {
          console.error("Company onboarding rollback failed:", rollbackError);
        }
        throw userError;
      }
    }

    return NextResponse.json(
      { message: "Company and initial admin created. You can now sign in." },
      { status: 201 }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "Company code, username, or email already exists for this company." },
        { status: 409 }
      );
    }

    console.error("Company onboarding failed:", error);
    return NextResponse.json({ error: "Unable to complete company onboarding." }, { status: 500 });
  }
}
