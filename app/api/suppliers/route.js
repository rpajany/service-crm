import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import Supplier from "@/models/Supplier";
import ItemMaster from "@/models/ItemMaster";
import { INDIAN_STATES } from "@/lib/indian-states";

export const runtime = "nodejs";
const supplierSchema = z.object({
  supplier_code: z.string().trim().max(40).optional().default(""),
  supplier_name: z.string().trim().min(1, "Supplier name is required.").max(200),
  contact_person: z.string().trim().max(150).optional().default(""),
  address: z.string().trim().min(1, "Address is required.").max(500),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().min(1, "Supplier state is required.").max(2).refine((value) => INDIAN_STATES.some((state) => state.value === value), "Select a valid Indian state or union territory."),
  pincode: z.string().trim().max(20).optional().default(""),
  country: z.string().trim().max(100).optional().default("India"),
  gstin: z.string().trim().max(20).optional().default("").transform((value) => value.toUpperCase()),
  mobile: z.string().trim().min(1, "Mobile is required.").max(30),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional().default(""),
  remarks: z.string().trim().max(1000).optional().default("")
});

async function authorize(write = false) {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true }).select("_id role companyId").lean();
  if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
  const company = await Company.findOne({ _id: user.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  if (write && !["admin", "staff"].includes(user.role)) return { error: "You do not have permission to change supplier records.", status: 403 };
  return { session, user };
}
function safeSupplier(s) {
  return { id: String(s._id), supplier_code: s.supplier_code, supplier_name: s.supplier_name, contact_person: s.contact_person, address: s.address, city: s.city, state: s.state, pincode: s.pincode, country: s.country, gstin: s.gstin, mobile: s.mobile, email: s.email, remarks: s.remarks, createdAt: s.createdAt, updatedAt: s.updatedAt };
}
async function nextSupplierCode(companyid) {
  const count = await Supplier.countDocuments({ companyid });
  let number = count + 1;
  let code = `SUP-${String(number).padStart(5, "0")}`;
  while (await Supplier.exists({ companyid, supplier_code: code })) { number += 1; code = `SUP-${String(number).padStart(5, "0")}`; }
  return code;
}
export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const search = (new URL(request.url).searchParams.get("search") || "").trim().slice(0, 100);
    const filter = { companyid: auth.session.companyId };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = ["supplier_code", "supplier_name", "contact_person", "address", "city", "state", "gstin", "mobile", "email"].map((key) => ({ [key]: regex }));
    }
    const suppliers = await Supplier.find(filter).sort({ supplier_name: 1 }).limit(5000).lean();
    return NextResponse.json({ suppliers: suppliers.map(safeSupplier), permissions: { canWrite: ["admin", "staff"].includes(auth.user.role), canDelete: auth.user.role === "admin" } });
  } catch (error) { console.error("List suppliers failed:", error); return NextResponse.json({ error: "Unable to load suppliers." }, { status: 500 }); }
}
export async function POST(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check supplier fields." }, { status: 400 });
    const supplier = new Supplier({ ...parsed.data, supplier_code: await nextSupplierCode(auth.session.companyId), companyid: auth.session.companyId });
    await supplier.save();
    return NextResponse.json({ message: "Supplier created.", supplier: safeSupplier(supplier) }, { status: 201 });
  } catch (error) { if (error?.code === 11000) return NextResponse.json({ error: "Supplier code already exists in your company." }, { status: 409 }); console.error("Create supplier failed:", error); return NextResponse.json({ error: "Unable to create supplier." }, { status: 500 }); }
}
export async function PUT(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    if (!mongoose.isValidObjectId(body.id)) return NextResponse.json({ error: "Invalid supplier ID." }, { status: 400 });
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check supplier fields." }, { status: 400 });
    const supplier = await Supplier.findOne({ _id: body.id, companyid: auth.session.companyId });
    if (!supplier) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    Object.assign(supplier, parsed.data);
    await supplier.save();
    return NextResponse.json({ message: "Supplier updated.", supplier: safeSupplier(supplier) });
  } catch (error) { if (error?.code === 11000) return NextResponse.json({ error: "Supplier code already exists in your company." }, { status: 409 }); console.error("Update supplier failed:", error); return NextResponse.json({ error: "Unable to update supplier." }, { status: 500 }); }
}
export async function DELETE(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete records." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid supplier ID." }, { status: 400 });
    const supplier = await Supplier.findOne({ _id: id, companyid: auth.session.companyId }).select("_id").lean();
    if (!supplier) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    const linkedItem = await ItemMaster.exists({ companyid: auth.session.companyId, supplier_id: supplier._id });
    if (linkedItem) return NextResponse.json({ error: "This supplier is linked to ItemMaster records. Change those supplier selections before deleting it." }, { status: 409 });
    await Supplier.deleteOne({ _id: supplier._id, companyid: auth.session.companyId });
    return NextResponse.json({ message: "Supplier deleted." });
  } catch (error) { console.error("Delete supplier failed:", error); return NextResponse.json({ error: "Unable to delete supplier." }, { status: 500 }); }
}
