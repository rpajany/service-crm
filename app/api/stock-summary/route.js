import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import ItemMaster from "@/models/ItemMaster";
import StockMovement from "@/models/StockMovement";

export const runtime = "nodejs";

async function authorize() {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true }).select("_id companyId role").lean();
  if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
  const company = await Company.findOne({ _id: user.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  return { session, user };
}

function dateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") || "").trim().slice(0, 100);
    const type = (params.get("type") || "all").toLowerCase();
    const from = dateStart(params.get("from"));
    const to = dateEnd(params.get("to"));
    if (params.get("from") && !from) return NextResponse.json({ error: "Invalid From Date." }, { status: 400 });
    if (params.get("to") && !to) return NextResponse.json({ error: "Invalid To Date." }, { status: 400 });
    if (from && to && from > to) return NextResponse.json({ error: "From Date must be on or before To Date." }, { status: 400 });

    const filter = { companyid: auth.session.companyId };
    if (from || to) filter.invoice_date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    if (type !== "all") {
      const allowed = ["itemmaster", "purchase", "sales", "adjustment", "reversal"];
      if (!allowed.includes(type)) return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
      filter.transaction_type = type;
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = ["invoice_number", "item_code", "item_name", "part_number", "model_number", "remarks", "transaction_type"].map((field) => ({ [field]: regex }));
    }

    // The report's movement rows are filtered by invoice date; ItemMaster entries
    // are written to this ledger when an item is created or its opening quantity changes.
    const movements = await StockMovement.find(filter).sort({ invoice_date: -1, created_at: -1 }).limit(5000).lean();
    // Current stock is read from ItemMaster.qty, not reconstructed from a filtered date range.
    const currentItems = await ItemMaster.find({ companyid: auth.session.companyId }).select("_id item_code description part_number model_number qty").sort({ item_code: 1 }).limit(5000).lean();
    return NextResponse.json({
      movements: movements.map((row) => ({
        id: String(row._id), type: row.transaction_type, invoice_number: row.invoice_number,
        invoice_date: row.invoice_date, item_id: String(row.item_id), item_code: row.item_code,
        item_name: row.item_name, part_number: row.part_number, model_number: row.model_number,
        stock_qty: row.stock_qty, transact_qty: row.transact_qty, hand_stock_qty: row.hand_stock_qty,
        remarks: row.remarks, created_at: row.created_at
      })),
      currentItems: currentItems.map((item) => ({ id: String(item._id), item_code: item.item_code, item_name: item.description, part_number: item.part_number, model_number: item.model_number, qty: item.qty })),
      limited: movements.length === 5000
    });
  } catch (error) {
    console.error("Load Stock Summary failed:", error);
    return NextResponse.json({ error: "Unable to load Stock Summary." }, { status: 500 });
  }
}

// Future Purchase/Sales APIs can call this helper after validating their invoice.
// It records a movement and never edits/deletes historical ledger rows.
export async function POST(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!mongoose.isValidObjectId(auth.session.companyId)) return NextResponse.json({ error: "Invalid company." }, { status: 400 });
    if (! ["admin", "staff"].includes(auth.user.role)) return NextResponse.json({ error: "You do not have permission to record stock movements.", status: 403 });
    const body = await request.json();
    // This endpoint is intentionally for manual adjustments only; purchase/sales
    // movement creation will be tied to invoice saves in those modules.
    if (body.transaction_type !== "adjustment") return NextResponse.json({ error: "Only adjustment movements can be created directly here." }, { status: 400 });
    if (!mongoose.isValidObjectId(body.item_id) || !Number.isFinite(Number(body.transact_qty)) || !String(body.remarks || "").trim()) {
      return NextResponse.json({ error: "A valid item, quantity change, and remarks are required." }, { status: 400 });
    }
    const item = await ItemMaster.findOne({ _id: body.item_id, companyid: auth.session.companyId });
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    const delta = Number(body.transact_qty);
    const before = item.qty;
    const after = before + delta;
    if (after < 0) return NextResponse.json({ error: "Stock cannot become negative." }, { status: 400 });
    item.qty = after;
    await item.save();
    try {
      const movement = await StockMovement.create({
        companyid: auth.session.companyId, item_id: item._id, transaction_type: "adjustment",
        invoice_number: String(body.invoice_number || "").trim(), invoice_date: body.invoice_date ? new Date(body.invoice_date) : new Date(),
        item_code: item.item_code, item_name: item.description, part_number: item.part_number,
        model_number: item.model_number, stock_qty: before, transact_qty: delta,
        hand_stock_qty: after, remarks: String(body.remarks).trim()
      });
      return NextResponse.json({ message: "Stock adjustment recorded.", id: String(movement._id), qty: after }, { status: 201 });
    } catch (ledgerError) {
      // If audit history cannot be saved, restore the old quantity rather than silently losing history.
      item.qty = before;
      await item.save();
      throw ledgerError;
    }
  } catch (error) {
    console.error("Record stock adjustment failed:", error);
    return NextResponse.json({ error: "Unable to record stock adjustment." }, { status: 500 });
  }
}
