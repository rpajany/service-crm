import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import ItemMaster from "@/models/ItemMaster";
import EngineerStore from "@/models/EngineerStore";
import EngineerStock from "@/models/EngineerStock";
import StockMovement from "@/models/StockMovement";
import RMIConsumption from "@/models/RMIConsumption";

export const runtime = "nodejs";

async function authorize({ write = false } = {}) {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true })
    .select("_id username role companyId").lean();
  if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
  const company = await Company.findOne({ _id: user.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  if (write && !["admin", "staff"].includes(user.role)) {
    return { error: "Only admins and staff can issue engineer stock.", status: 403 };
  }
  return { session, user };
}

const issueSchema = z.object({
  item_id: z.string().refine(mongoose.isValidObjectId, "Select a valid ItemMaster item."),
  engineer_id: z.string().refine(mongoose.isValidObjectId, "Select a valid engineer."),
  issue_qty: z.coerce.number().finite().positive("Issue quantity must be greater than zero."),
  issue_date: z.string().min(1, "Issue date is required.")
});

function dateFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(`${from}T00:00:00.000`);
  if (to) filter.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(filter).length ? filter : null;
}

export async function GET(request) {
  try {
    const auth = await authorize();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const companyid = auth.session.companyId;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "transactions";

    if (view === "lookups") {
      // Fetch only fields required by the entry form to keep its initial payload small.
      const [items, engineers] = await Promise.all([
        ItemMaster.find({ companyid }).select("_id item_code description part_number model_number qty").sort({ item_code: 1 }).limit(2000).lean(),
        User.find({ companyId: companyid, role: "engineer", isActive: true }).select("_id username fullName").sort({ username: 1 }).lean()
      ]);
      return NextResponse.json({
        items: items.map((item) => ({ id: String(item._id), item_code: item.item_code, description: item.description, part_number: item.part_number, model_number: item.model_number, qty: item.qty })),
        engineers: engineers.map((engineer) => ({ id: String(engineer._id), username: engineer.username, fullName: engineer.fullName })),
        canIssue: ["admin", "staff"].includes(auth.user.role)
      });
    }

    // Eng_Store behaves like a compact ItemMaster: show one row per item with its combined balance.
    // It is a current-stock view, so date filters do not apply to this tab.
    if (view === "store") {
      const search = (searchParams.get("search") || "").trim().slice(0, 100);
      const filter = { companyid };
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        filter.$or = ["item_code", "description", "part_number", "model_number"].map((field) => ({ [field]: regex }));
      }
      const items = await EngineerStore.find(filter)
        .select("_id item_code description part_number model_number total_qty")
        .sort({ item_code: 1 })
        .limit(5000)
        .lean();
      return NextResponse.json({ items: items.map((item) => ({
        id: String(item._id), item_code: item.item_code, description: item.description,
        part_number: item.part_number, model_number: item.model_number, total_qty: item.total_qty
      })) });
    }

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const filter = { companyid };
    const range = dateFilter(from, to);
    if (range) filter.issue_date = range;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = ["eng_name", "item_code", "description", "part_number", "model_number"].map((field) => ({ [field]: regex }));
    }

    if (view === "summary") {
      // StockByEng is calculated from the issue ledger, so no third model is needed.
      const summaryMatch = { companyid: new mongoose.Types.ObjectId(String(companyid)) };
      if (range) summaryMatch.issue_date = range;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        summaryMatch.$or = ["eng_name", "item_code", "description", "part_number", "model_number"].map((field) => ({ [field]: regex }));
      }
      const summary = await EngineerStock.aggregate([
        { $match: summaryMatch },
        { $group: {
          _id: { engineer_id: "$engineer_id", eng_name: "$eng_name", item_id: "$item_id", item_code: "$item_code", description: "$description", part_number: "$part_number", model_number: "$model_number" },
          issued_qty: { $sum: "$issue_qty" }, latest_issue_date: { $max: "$issue_date" }
        } },
        // Subtract RMI consumption for the same company, engineer and EngineerStore item.
        // The optional date range is applied to both issue and consumption movements.
        { $lookup: {
          from: RMIConsumption.collection.name,
          let: { engineerId: "$_id.engineer_id", itemId: "$_id.item_id" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$companyid", new mongoose.Types.ObjectId(String(companyid))] },
              { $eq: ["$engineer_id", "$$engineerId"] },
              { $eq: ["$item_id", "$$itemId"] },
              ...(range ? [{ $gte: ["$rmi_date", range.$gte || new Date("1970-01-01T00:00:00.000Z")] }] : []),
              ...(range?.$lte ? [{ $lte: ["$rmi_date", range.$lte] }] : [])
            ] } } },
            { $group: { _id: null, qty: { $sum: "$rmi_qty" } } }
          ],
          as: "consumption"
        } },
        { $addFields: { total_qty: { $subtract: ["$issued_qty", { $ifNull: [{ $arrayElemAt: ["$consumption.qty", 0] }, 0] }] } } },
        { $match: { total_qty: { $gt: 0 } } },
        { $sort: { "_id.eng_name": 1, "_id.item_code": 1 } },
        { $limit: 5000 }
      ]);
      const rows = summary.map((row) => ({
        engineer_id: String(row._id.engineer_id), eng_name: row._id.eng_name,
        item_code: row._id.item_code, description: row._id.description,
        part_number: row._id.part_number, model_number: row._id.model_number,
        total_qty: row.total_qty, latest_issue_date: row.latest_issue_date
      }));
      return NextResponse.json({ rows });
    }

    const records = await EngineerStock.find(filter).sort({ issue_date: -1, createdAt: -1 }).limit(5000).lean();
    return NextResponse.json({ records: records.map((row) => ({
      id: String(row._id), eng_name: row.eng_name, item_code: row.item_code,
      description: row.description, part_number: row.part_number, model_number: row.model_number,
      issue_qty: row.issue_qty, issue_date: row.issue_date, createdAt: row.createdAt
    })) });
  } catch (error) {
    console.error("Engineer stock list failed:", error);
    return NextResponse.json({ error: "Unable to load engineer stock data." }, { status: 500 });
  }
}

export async function POST(request) {
  let itemUpdate = null;
  let storeUpdate = null;
  let transaction = null;
  let movement = null;
  try {
    const auth = await authorize({ write: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = issueSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the stock issue details." }, { status: 400 });

    const { item_id, engineer_id, issue_qty, issue_date } = parsed.data;
    const parsedDate = new Date(`${issue_date}T00:00:00.000`);
    if (Number.isNaN(parsedDate.getTime())) return NextResponse.json({ error: "Invalid issue date." }, { status: 400 });
    const companyid = auth.session.companyId;

    // Both selected records are checked against the logged-in tenant.
    const [item, engineer] = await Promise.all([
      ItemMaster.findOne({ _id: item_id, companyid }).lean(),
      User.findOne({ _id: engineer_id, companyId: companyid, role: "engineer", isActive: true }).select("_id username").lean()
    ]);
    if (!item) return NextResponse.json({ error: "Selected ItemMaster item was not found." }, { status: 404 });
    if (!engineer) return NextResponse.json({ error: "Selected active engineer was not found." }, { status: 404 });
    if (Number(item.qty) < issue_qty) return NextResponse.json({ error: `Insufficient ItemMaster stock. Available quantity: ${item.qty}.` }, { status: 400 });

    // Conditional decrement prevents two simultaneous requests issuing the same units.
    const updatedItem = await ItemMaster.findOneAndUpdate(
      { _id: item_id, companyid, qty: { $gte: issue_qty } },
      { $inc: { qty: -issue_qty } },
      { new: true }
    ).lean();
    if (!updatedItem) return NextResponse.json({ error: "Stock changed while issuing. Refresh and try again." }, { status: 409 });
    itemUpdate = { id: item_id, previousQty: Number(item.qty), nextQty: Number(updatedItem.qty) };

    // Upsert one shared EngineerStore item row and increase its combined balance.
    const store = await EngineerStore.findOneAndUpdate(
      { companyid, item_id },
      { $setOnInsert: { item_code: item.item_code, description: item.description, part_number: item.part_number || "", model_number: item.model_number || "" }, $inc: { total_qty: issue_qty } },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    storeUpdate = { id: String(store._id), qty: issue_qty };

    transaction = await EngineerStock.create({
      companyid, engineer_id: engineer._id, eng_name: engineer.username,
      item_id: store._id, item_code: item.item_code, description: item.description,
      part_number: item.part_number || "", model_number: item.model_number || "",
      issue_qty, issue_date: parsedDate, issued_by: auth.user._id
    });

    movement = await StockMovement.create({
      companyid, item_id: item._id, engineer_id: engineer._id,
      transaction_type: "engineer_issue", invoice_number: "", invoice_date: parsedDate,
      item_code: item.item_code, item_name: item.description,
      part_number: item.part_number || "", model_number: item.model_number || "",
      stock_qty: item.qty, transact_qty: -issue_qty, hand_stock_qty: updatedItem.qty,
      remarks: `Stock Issued to Engineer - ${engineer.username}`
    });

    return NextResponse.json({ message: `Stock issued successfully to ${engineer.username}.`, transaction: { id: String(transaction._id), issue_qty, item_code: item.item_code, eng_name: engineer.username } }, { status: 201 });
  } catch (error) {
    // Local MongoDB may run as a standalone server without replica-set transactions.
    // Compensating updates keep the three stock records consistent if a later write fails.
    try {
      if (movement) await StockMovement.deleteOne({ _id: movement._id });
      if (transaction) await EngineerStock.deleteOne({ _id: transaction._id });
      if (storeUpdate) await EngineerStore.updateOne({ _id: storeUpdate.id }, { $inc: { total_qty: -storeUpdate.qty } });
      if (itemUpdate) await ItemMaster.updateOne({ _id: itemUpdate.id }, { $inc: { qty: Number(itemUpdate.previousQty) - Number(itemUpdate.nextQty) } });
    } catch (rollbackError) {
      console.error("Engineer stock rollback failed; manual reconciliation may be required:", rollbackError);
    }
    console.error("Issue engineer stock failed:", error);
    if (error?.code === 11000) return NextResponse.json({ error: "Engineer store item already exists. Please retry the issue." }, { status: 409 });
    return NextResponse.json({ error: "Unable to issue engineer stock. Please check the stock balances before retrying." }, { status: 500 });
  }
}
