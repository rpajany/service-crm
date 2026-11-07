import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import EngineerStore from "@/models/EngineerStore";
import EngineerStock from "@/models/EngineerStock";
import RMIConsumption from "@/models/RMIConsumption";

export const runtime = "nodejs";

async function authorize(write = false) {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true }).select("_id username role companyId").lean();
  if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
  const company = await Company.findOne({ _id: user.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  if (write && !["admin", "staff"].includes(user.role)) return { error: "Only admins and staff can manage RMI consumption.", status: 403 };
  return { session, user };
}

const inputSchema = z.object({
  engineer_id: z.string().refine(mongoose.isValidObjectId, "Select a valid engineer."),
  item_id: z.string().refine(mongoose.isValidObjectId, "Select a valid engineer stock item."),
  rmi_no: z.string().trim().min(1, "RMI No is required.").max(100),
  rmi_qty: z.coerce.number().finite().positive("RMI Qty must be greater than zero."),
  rmi_date: z.string().min(1, "RMI Date is required.")
});

function parseDate(value) {
  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateRange(from, to) {
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(range).length ? range : null;
}
// Calculate one engineer's available quantity from the immutable issue and consumption ledgers.
async function availableQty(companyid, engineerId, itemId, excludeId = null) {
  const match = { companyid: new mongoose.Types.ObjectId(String(companyid)), engineer_id: new mongoose.Types.ObjectId(String(engineerId)), item_id: new mongoose.Types.ObjectId(String(itemId)) };
  const issued = await EngineerStock.aggregate([{ $match: match }, { $group: { _id: null, qty: { $sum: "$issue_qty" } } }]);
  const consumedMatch = { ...match };
  if (excludeId) consumedMatch._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  const consumed = await RMIConsumption.aggregate([{ $match: consumedMatch }, { $group: { _id: null, qty: { $sum: "$rmi_qty" } } }]);
  return Number(issued[0]?.qty || 0) - Number(consumed[0]?.qty || 0);
}

export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const companyid = auth.session.companyId;
    const params = new URL(request.url).searchParams;
    const view = params.get("view") || "list";
    if (view === "lookups") {
      const engineers = await User.find({ companyId: companyid, role: "engineer", isActive: true }).select("_id username fullName").sort({ username: 1 }).lean();
      return NextResponse.json({ engineers: engineers.map((u) => ({ id: String(u._id), username: u.username, fullName: u.fullName })) });
    }
    if (view === "items") {
      const engineerId = params.get("engineer_id");
      if (!mongoose.isValidObjectId(engineerId)) return NextResponse.json({ error: "Select an engineer first." }, { status: 400 });
      const engineer = await User.findOne({ _id: engineerId, companyId: companyid, role: "engineer", isActive: true }).select("_id").lean();
      if (!engineer) return NextResponse.json({ error: "Active engineer not found." }, { status: 404 });
      const rows = await EngineerStock.aggregate([
        { $match: { companyid: new mongoose.Types.ObjectId(String(companyid)), engineer_id: engineer._id } },
        { $group: { _id: "$item_id", item_code: { $first: "$item_code" }, description: { $first: "$description" }, part_number: { $first: "$part_number" }, model_number: { $first: "$model_number" }, issued_qty: { $sum: "$issue_qty" } } },
        { $lookup: { from: RMIConsumption.collection.name, let: { itemId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$companyid", new mongoose.Types.ObjectId(String(companyid))] }, { $eq: ["$engineer_id", engineer._id] }, { $eq: ["$item_id", "$$itemId"] }] } } }, { $group: { _id: null, qty: { $sum: "$rmi_qty" } } }], as: "consumed" } },
        { $addFields: { available_qty: { $subtract: ["$issued_qty", { $ifNull: [{ $arrayElemAt: ["$consumed.qty", 0] }, 0] }] } } },
        { $match: { available_qty: { $gt: 0 } } }, { $sort: { item_code: 1 } }, { $limit: 2000 }
      ]);
      return NextResponse.json({ items: rows.map((r) => ({ id: String(r._id), item_code: r.item_code, description: r.description, part_number: r.part_number || "", model_number: r.model_number || "", available_qty: r.available_qty })) });
    }
    const from = params.get("from") || ""; const to = params.get("to") || ""; const search = (params.get("search") || "").trim().slice(0, 100);
    const filter = { companyid };
    const range = dateRange(from, to); if (range) filter.rmi_date = range;
    if (search) { const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = ["rmi_no", "eng_name", "item_code", "description", "part_number", "model_number"].map((field) => ({ [field]: rx })); }
    const rows = await RMIConsumption.find(filter).sort({ rmi_date: -1, createdAt: -1 }).limit(5000).lean();
    return NextResponse.json({ records: rows.map((r) => ({ id: String(r._id), engineer_id: String(r.engineer_id), eng_name: r.eng_name, item_id: String(r.item_id), item_code: r.item_code, description: r.description, part_number: r.part_number, model_number: r.model_number, rmi_no: r.rmi_no, rmi_qty: r.rmi_qty, rmi_date: r.rmi_date })) });
  } catch (error) { console.error("RMI list failed:", error); return NextResponse.json({ error: "Unable to load RMI records." }, { status: 500 }); }
}

// Atomically change the combined EngineerStore balance for one item.
// A negative delta consumes stock; a positive delta restores stock.
async function changeStoreQty(companyid, itemId, delta) {
  if (!delta) return null;
  const filter = { _id: itemId, companyid };
  if (delta < 0) filter.total_qty = { $gte: Math.abs(delta) };
  const updated = await EngineerStore.findOneAndUpdate(
    filter,
    { $inc: { total_qty: delta } },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) {
    throw new Error(delta < 0
      ? "Engineer Store does not have enough combined stock for this consumption."
      : "Engineer Store item was not found while restoring stock.");
  }
  return updated;
}

export async function POST(request) {
  let storeChanged = false;
  let issueQtyForRollback = 0;
  let companyForRollback = null;
  let storeItemId = null;
  let createdRecordId = null;
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check RMI details." }, { status: 400 });
    const input = parsed.data;
    issueQtyForRollback = input.rmi_qty;
    companyForRollback = auth.session.companyId;
    const rmiDate = parseDate(input.rmi_date);
    if (!rmiDate) return NextResponse.json({ error: "Invalid RMI Date." }, { status: 400 });

    const [engineer, item] = await Promise.all([
      User.findOne({ _id: input.engineer_id, companyId: auth.session.companyId, role: "engineer", isActive: true }).select("_id username").lean(),
      EngineerStore.findOne({ _id: input.item_id, companyid: auth.session.companyId }).lean()
    ]);
    if (!engineer || !item) return NextResponse.json({ error: "Selected engineer or Engineer Store item was not found." }, { status: 404 });

    // Validate the engineer-specific ledger balance before changing the shared store balance.
    const available = await availableQty(auth.session.companyId, engineer._id, item._id);
    if (input.rmi_qty > available) return NextResponse.json({ error: `Insufficient engineer stock. Available quantity: ${available}.` }, { status: 400 });

    // Reduce the combined EngineerStore balance, then write the consumption ledger.
    await changeStoreQty(auth.session.companyId, item._id, -input.rmi_qty);
    storeChanged = true;
    storeItemId = item._id;

    const record = await RMIConsumption.create({
      companyid: auth.session.companyId,
      engineer_id: engineer._id,
      eng_name: engineer.username,
      item_id: item._id,
      item_code: item.item_code,
      description: item.description,
      part_number: item.part_number || "",
      model_number: item.model_number || "",
      rmi_no: input.rmi_no,
      rmi_qty: input.rmi_qty,
      rmi_date: rmiDate,
      consumed_by: auth.user._id
    });
    createdRecordId = record._id;
    return NextResponse.json({ message: "RMI consumption saved and Engineer Store stock updated successfully.", id: String(record._id) }, { status: 201 });
  } catch (error) {
    // Standalone local MongoDB may not support multi-document transactions.
    // Compensate the store balance if creating the ledger record fails.
    try {
      if (createdRecordId) await RMIConsumption.deleteOne({ _id: createdRecordId, companyid: companyForRollback });
      if (storeChanged) await EngineerStore.updateOne({ _id: storeItemId, companyid: companyForRollback }, { $inc: { total_qty: issueQtyForRollback } });
    } catch (rollbackError) {
      console.error("RMI create rollback failed; reconcile EngineerStore and RMIConsumption:", rollbackError);
    }
    console.error("Create RMI failed:", error);
    if (error?.message?.startsWith("Engineer Store")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to save RMI consumption. Please verify engineer stock before retrying." }, { status: 500 });
  }
}

export async function PUT(request) {
  let savedRecord = false;
  let oldSnapshot = null;
  const storeAdjustments = [];
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const id = body.id;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid RMI record." }, { status: 400 });
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check RMI details." }, { status: 400 });
    const input = parsed.data;
    const rmiDate = parseDate(input.rmi_date);
    if (!rmiDate) return NextResponse.json({ error: "Invalid RMI Date." }, { status: 400 });

    const existing = await RMIConsumption.findOne({ _id: id, companyid: auth.session.companyId });
    if (!existing) return NextResponse.json({ error: "RMI record not found." }, { status: 404 });
    oldSnapshot = existing.toObject();

    const [engineer, item] = await Promise.all([
      User.findOne({ _id: input.engineer_id, companyId: auth.session.companyId, role: "engineer", isActive: true }).select("_id username").lean(),
      EngineerStore.findOne({ _id: input.item_id, companyid: auth.session.companyId }).lean()
    ]);
    if (!engineer || !item) return NextResponse.json({ error: "Selected engineer or Engineer Store item was not found." }, { status: 404 });

    // Exclude this RMI while validating the edited transaction.
    const availableWithoutThisRmi = await availableQty(auth.session.companyId, engineer._id, item._id, existing._id);
    if (input.rmi_qty > availableWithoutThisRmi) return NextResponse.json({ error: `Insufficient engineer stock. Available quantity: ${availableWithoutThisRmi}.` }, { status: 400 });

    const sameStoreItem = String(existing.item_id) === String(item._id);
    if (sameStoreItem) {
      // Same item: restore the old consumption and apply the new consumption as one net change.
      const delta = Number(existing.rmi_qty) - input.rmi_qty;
      if (delta) {
        await changeStoreQty(auth.session.companyId, item._id, delta);
        storeAdjustments.push({ itemId: item._id, delta });
      }
    } else {
      // Different item: restore the old item and consume the newly selected item.
      await changeStoreQty(auth.session.companyId, existing.item_id, Number(existing.rmi_qty));
      storeAdjustments.push({ itemId: existing.item_id, delta: Number(existing.rmi_qty) });
      await changeStoreQty(auth.session.companyId, item._id, -input.rmi_qty);
      storeAdjustments.push({ itemId: item._id, delta: -input.rmi_qty });
    }

    Object.assign(existing, {
      engineer_id: engineer._id,
      eng_name: engineer.username,
      item_id: item._id,
      item_code: item.item_code,
      description: item.description,
      part_number: item.part_number || "",
      model_number: item.model_number || "",
      rmi_no: input.rmi_no,
      rmi_qty: input.rmi_qty,
      rmi_date: rmiDate
    });
    await existing.save();
    savedRecord = true;
    return NextResponse.json({ message: "RMI record updated and Engineer Store stock recalculated successfully." });
  } catch (error) {
    // Restore the old store/record state if any step after a balance change fails.
    try {
      if (!savedRecord && oldSnapshot) {
        const current = await RMIConsumption.findOne({ _id: oldSnapshot._id, companyid: oldSnapshot.companyid });
        if (current) {
          Object.assign(current, oldSnapshot);
          await current.save();
        }
        // Reverse every completed balance adjustment in reverse order.
        for (const adjustment of [...storeAdjustments].reverse()) {
          await EngineerStore.updateOne(
            { _id: adjustment.itemId, companyid: oldSnapshot.companyid },
            { $inc: { total_qty: -adjustment.delta } }
          );
        }
      }
    } catch (rollbackError) {
      console.error("RMI update rollback failed; reconcile EngineerStore and RMIConsumption:", rollbackError);
    }
    console.error("Update RMI failed:", error);
    if (error?.message?.startsWith("Engineer Store")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to update RMI record. Please verify stock balances." }, { status: 500 });
  }
}

export async function DELETE(request) {
  let restoredQty = 0;
  let restoredItemId = null;
  let deletedRecord = null;
  try {
    const auth = await authorize(true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const id = new URL(request.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid RMI record." }, { status: 400 });

    const record = await RMIConsumption.findOne({ _id: id, companyid: auth.session.companyId });
    if (!record) return NextResponse.json({ error: "RMI record not found." }, { status: 404 });

    // Restore the consumed quantity to EngineerStore before removing the consumption ledger.
    restoredQty = Number(record.rmi_qty);
    restoredItemId = record.item_id;
    await changeStoreQty(auth.session.companyId, restoredItemId, restoredQty);

    const result = await RMIConsumption.deleteOne({ _id: id, companyid: auth.session.companyId });
    if (!result.deletedCount) {
      await EngineerStore.updateOne({ _id: restoredItemId, companyid: auth.session.companyId }, { $inc: { total_qty: -restoredQty } });
      return NextResponse.json({ error: "RMI record changed before deletion. Refresh and try again." }, { status: 409 });
    }
    deletedRecord = record;
    return NextResponse.json({ message: "RMI record deleted and Engineer Store stock restored successfully." });
  } catch (error) {
    // If deletion fails after restoring stock, reverse that restoration.
    try {
      if (restoredQty && restoredItemId && !deletedRecord) {
        await EngineerStore.updateOne({ _id: restoredItemId }, { $inc: { total_qty: -restoredQty } });
      }
    } catch (rollbackError) {
      console.error("RMI delete rollback failed; reconcile EngineerStore and RMIConsumption:", rollbackError);
    }
    console.error("Delete RMI failed:", error);
    return NextResponse.json({ error: "Unable to delete RMI record. Please verify stock balances." }, { status: 500 });
  }
}
