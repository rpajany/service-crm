import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import Customer from "@/models/Customer";
import { INDIAN_STATES } from "@/lib/indian-states";

export const runtime = "nodejs";
const customerSchema = z.object({
  customer_code: z.string().trim().max(40).optional().default(""),
  customer_name: z.string().trim().min(1, "Customer name is required.").max(200),
  contact_person: z.string().trim().max(150).optional().default(""),
  address: z.string().trim().min(1, "Address is required.").max(500),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().min(1, "Customer state is required.").max(2).refine((value) => INDIAN_STATES.some((state) => state.value === value), "Select a valid Indian state or union territory."),
  place_of_supply: z.string().trim().max(2).optional().default("").refine((value) => value === "" || INDIAN_STATES.some((state) => state.value === value), "Select a valid place of supply."),
  pincode: z.string().trim().max(20).optional().default(""),
  country: z.string().trim().max(100).optional().default("India"),
  gstin: z.string().trim().max(20).optional().default(""),
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
  if (write && !["admin", "staff"].includes(user.role)) return { error: "You do not have permission to change customer records.", status: 403 };
  return { session, user };
}
function safeCustomer(c) {
  return { id: String(c._id), customer_code: c.customer_code, customer_name: c.customer_name, contact_person: c.contact_person, address: c.address, city: c.city, state: c.state, place_of_supply: c.place_of_supply || "", pincode: c.pincode, country: c.country, gstin: c.gstin, mobile: c.mobile, email: c.email, remarks: c.remarks, createdAt: c.createdAt, updatedAt: c.updatedAt };
}
async function nextCustomerCode(companyid) {
  const count = await Customer.countDocuments({ companyid });
  let code = `CUS-${String(count + 1).padStart(5, "0")}`;
  while (await Customer.exists({ companyid, customer_code: code })) code = `CUS-${String(Number(code.slice(4)) + 1).padStart(5, "0")}`;
  return code;
}
export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") || "").trim().slice(0, 100);
    const filter = { companyid: auth.session.companyId };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = ["customer_code", "customer_name", "contact_person", "address", "city", "state", "gstin", "mobile", "email"].map((key) => ({ [key]: regex }));
    }
    const customers = await Customer.find(filter).sort({ customer_name: 1 }).limit(5000).lean();
    return NextResponse.json({ customers: customers.map(safeCustomer), permissions: { canWrite: ["admin", "staff"].includes(auth.user.role), canDelete: auth.user.role === "admin" } });
  } catch (error) { console.error("List customers failed:", error); return NextResponse.json({ error: "Unable to load customers." }, { status: 500 }); }
}
export async function POST(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = customerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check customer fields." }, { status: 400 });
    const customer = new Customer({ ...parsed.data, customer_code: parsed.data.customer_code || await nextCustomerCode(auth.session.companyId), companyid: auth.session.companyId });
    await customer.save();
    return NextResponse.json({ message: "Customer created.", customer: safeCustomer(customer) }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "Customer code already exists in your company." }, { status: 409 });
    console.error("Create customer failed:", error); return NextResponse.json({ error: "Unable to create customer." }, { status: 500 });
  }
}
export async function PUT(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    if (!mongoose.isValidObjectId(body.id)) return NextResponse.json({ error: "Invalid customer ID." }, { status: 400 });
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check customer fields." }, { status: 400 });
    const customer = await Customer.findOne({ _id: body.id, companyid: auth.session.companyId });
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    Object.assign(customer, parsed.data);
    await customer.save();
    return NextResponse.json({ message: "Customer updated.", customer: safeCustomer(customer) });
  } catch (error) { if (error?.code === 11000) return NextResponse.json({ error: "Customer code already exists in your company." }, { status: 409 }); console.error("Update customer failed:", error); return NextResponse.json({ error: "Unable to update customer." }, { status: 500 }); }
}
export async function DELETE(request) {
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete records." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid customer ID." }, { status: 400 });
    const result = await Customer.deleteOne({ _id: id, companyid: auth.session.companyId });
    if (!result.deletedCount) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    return NextResponse.json({ message: "Customer deleted." });
  } catch (error) { console.error("Delete customer failed:", error); return NextResponse.json({ error: "Unable to delete customer." }, { status: 500 }); }
}
