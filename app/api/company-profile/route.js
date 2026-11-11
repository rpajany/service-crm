import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";
import { companyProfileSchema, formatValidationDetails } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 1024 * 1024;
const DATA_LOGO_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function validateLogoValue(logoUrl) {
  if (!logoUrl || !logoUrl.startsWith("data:")) return null;
  const match = logoUrl.match(DATA_LOGO_PATTERN);
  if (!match) return "Uploaded logo must be a PNG, JPEG, or WebP image.";
  const encoded = match[2];
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_LOGO_BYTES) return "Logo image must be 1 MB or smaller.";
  // Check the actual file signature instead of trusting the browser-provided MIME type.
  const validSignature =
    (match[1] === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (match[1] === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (match[1] === "image/webp" && bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
  if (!validSignature) return "The uploaded file does not match its declared image type.";
  return null;
}

async function getAuthorizedAdmin() {
  const session = await getSession();
  if (!session) return { error: "Authentication required.", status: 401 };

  // Check the current database role instead of trusting only the token role.
  await connectDB();
  const user = await User.findOne({
    _id: session.userId,
    companyId: session.companyId,
    isActive: true,
    role: "admin"
  }).select("_id companyId").lean();

  if (!user) return { error: "Only an active company admin can edit this profile.", status: 403 };

  return { session, user };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    await connectDB();
    const company = await Company.findOne({
      _id: session.companyId,
      status: "active"
    }).select("name slug email phone address website gstNumber logoUrl companySealUrl createdAt updatedAt").lean();

    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    return NextResponse.json({ company });
  } catch (error) {
    console.error("Company profile read failed:", error);
    return NextResponse.json({ error: "Unable to load company profile." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authorization = await getAuthorizedAdmin();
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const requestBody = await request.json();
    const parsed = companyProfileSchema.safeParse(requestBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the submitted fields.", details: formatValidationDetails(parsed.error) },
        { status: 400 }
      );
    }

    const logoError = validateLogoValue(parsed.data.logoUrl);
    const sealError = validateLogoValue(parsed.data.companySealUrl);
    const imageError = logoError || (sealError ? `Company seal: ${sealError}` : null);
    if (imageError) {
      return NextResponse.json(
        { error: imageError, details: { formErrors: [], fieldErrors: { ...(logoError ? { logoUrl: [logoError] } : {}), ...(sealError ? { companySealUrl: [sealError] } : {}) } } },
        { status: 400 }
      );
    }

    // Explicit allow-list: status, slug, and other platform fields cannot be changed here.
    const updated = await Company.findOneAndUpdate(
      { _id: authorization.session.companyId, status: "active" },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).select("name slug email phone address website gstNumber logoUrl companySealUrl updatedAt").lean();

    if (!updated) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    return NextResponse.json({ message: "Company profile updated.", company: updated });
  } catch (error) {
    console.error("Company profile update failed:", error);
    return NextResponse.json({ error: "Unable to update company profile." }, { status: 500 });
  }
}
