import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import ItemMaster from "@/models/ItemMaster";
import StockMovement from "@/models/StockMovement";
import Supplier from "@/models/Supplier";

export const runtime = "nodejs";

const itemSchema = z.object({
  item_code: z.string().trim().min(1, "Item code is required.").max(80).transform((v) => v.toUpperCase()),
  part_number: z.string().trim().max(100).optional().default(""),
  model_number: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().min(1, "Description is required.").max(500),
  qty: z.coerce.number().finite().min(0, "Quantity cannot be negative."),
  supplier_id: z.string().trim().optional().default(""),
  supplier_name: z.string().trim().max(200).optional().default(""),
  purchase_price: z.coerce.number().finite().min(0, "Purchase price cannot be negative."),
  selling_price: z.coerce.number().finite().min(0, "Selling price cannot be negative."),
  gst: z.coerce.number().finite().min(0).max(100, "GST must be between 0 and 100."),
  hsn_code: z.string().trim().max(30).optional().default("")
});

async function authorize({ write = false } = {}) {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  // Re-check the user and tenant status in MongoDB instead of trusting old JWT claims.
  const user = await User.findOne({
    _id: session.userId,
    companyId: session.companyId,
    isActive: true
  }).select("_id role companyId").lean();
  if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
  const company = await Company.findOne({ _id: user.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  // Admins and staff can maintain item data; engineers can view it only.
  if (write && !["admin", "staff"].includes(user.role)) {
    return { error: "You do not have permission to change ItemMaster records.", status: 403 };
  }
  return { session, user };
}

function safeItem(item) {
  return {
    id: String(item._id), item_code: item.item_code, part_number: item.part_number,
    model_number: item.model_number, description: item.description, qty: item.qty,
    supplier_id: item.supplier_id ? String(item.supplier_id) : "", supplier_name: item.supplier_name, purchase_price: item.purchase_price,
    selling_price: item.selling_price, gst: item.gst, hsn_code: item.hsn_code,
    createdAt: item.createdAt, updatedAt: item.updatedAt
  };
}

export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    // The company filter is mandatory: a tenant can never read another tenant's items.
    const filter = { companyid: auth.session.companyId };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = ["item_code", "part_number", "model_number", "description", "supplier_name", "hsn_code"].map((field) => ({ [field]: regex }));
    }
    const items = await ItemMaster.find(filter).sort({ item_code: 1 }).limit(2000).lean();
    return NextResponse.json({ items: items.map(safeItem), permissions: { canWrite: ["admin", "staff"].includes(auth.user.role), canDelete: auth.user.role === "admin" } });
  } catch (error) {
    console.error("List ItemMaster failed:", error);
    return NextResponse.json({ error: "Unable to load ItemMaster records." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authorize({ write: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = itemSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the item fields." }, { status: 400 });
    if (parsed.data.supplier_id) {
      if (!mongoose.isValidObjectId(parsed.data.supplier_id)) return NextResponse.json({ error: "Invalid supplier selection." }, { status: 400 });
      const supplier = await Supplier.findOne({ _id: parsed.data.supplier_id, companyid: auth.session.companyId }).select("supplier_name").lean();
      if (!supplier) return NextResponse.json({ error: "Selected supplier was not found in your company." }, { status: 400 });
      parsed.data.supplier_name = supplier.supplier_name;
    } else parsed.data.supplier_id = null;
    const item = new ItemMaster({ ...parsed.data, companyid: auth.session.companyId });
    await item.save();
    try {
      // Every new ItemMaster entry is visible in Stock Summary, including zero opening stock.
      await StockMovement.create({
        companyid: auth.session.companyId, item_id: item._id, transaction_type: "itemmaster",
        invoice_number: "", invoice_date: item.createdAt || new Date(), item_code: item.item_code,
        item_name: item.description, part_number: item.part_number, model_number: item.model_number,
        stock_qty: 0, transact_qty: item.qty, hand_stock_qty: item.qty,
        remarks: "ItemMaster Add - New"
      });
    } catch (ledgerError) {
      // Avoid leaving an item behind if its required opening-stock history cannot be recorded.
      await ItemMaster.deleteOne({ _id: item._id, companyid: auth.session.companyId });
      throw ledgerError;
    }
    return NextResponse.json({ message: "Item created.", item: safeItem(item) }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "This item code already exists in your company." }, { status: 409 });
    console.error("Create ItemMaster failed:", error);
    return NextResponse.json({ error: "Unable to create item." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await authorize({ write: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    if (!mongoose.isValidObjectId(body.id)) return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the item fields." }, { status: 400 });
    if (parsed.data.supplier_id) {
      if (!mongoose.isValidObjectId(parsed.data.supplier_id)) return NextResponse.json({ error: "Invalid supplier selection." }, { status: 400 });
      const supplier = await Supplier.findOne({ _id: parsed.data.supplier_id, companyid: auth.session.companyId }).select("supplier_name").lean();
      if (!supplier) return NextResponse.json({ error: "Selected supplier was not found in your company." }, { status: 400 });
      parsed.data.supplier_name = supplier.supplier_name;
    } else parsed.data.supplier_id = null;
    // Load by both item ID and tenant ID to prevent cross-company edits.
    const item = await ItemMaster.findOne({ _id: body.id, companyid: auth.session.companyId });
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    const previousQty = Number(item.qty || 0);
    const nextQty = Number(parsed.data.qty);
    Object.assign(item, parsed.data);
    await item.save();
    if (nextQty !== previousQty) {
      try {
        // Keep old movements intact. A quantity edit adds a signed adjustment entry.
        await StockMovement.create({
          companyid: auth.session.companyId, item_id: item._id, transaction_type: "itemmaster",
          invoice_number: "", invoice_date: new Date(), item_code: item.item_code,
          item_name: item.description, part_number: item.part_number, model_number: item.model_number,
          stock_qty: previousQty, transact_qty: nextQty - previousQty, hand_stock_qty: nextQty,
          remarks: `ItemMaster Qty Adjustment - Edit (was ${previousQty}, now ${nextQty})`
        });
      } catch (ledgerError) {
        // Restore the old quantity if its audit record cannot be saved.
        item.qty = previousQty;
        await item.save();
        throw ledgerError;
      }
    }
    return NextResponse.json({ message: "Item updated.", item: safeItem(item) });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "This item code already exists in your company." }, { status: 409 });
    console.error("Update ItemMaster failed:", error);
    return NextResponse.json({ error: "Unable to update item." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authorize({ write: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete items." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
    const result = await ItemMaster.deleteOne({ _id: id, companyid: auth.session.companyId });
    if (!result.deletedCount) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ message: "Item deleted." });
  } catch (error) {
    console.error("Delete ItemMaster failed:", error);
    return NextResponse.json({ error: "Unable to delete item." }, { status: 500 });
  }
}
