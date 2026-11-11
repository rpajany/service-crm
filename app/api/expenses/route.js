import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import Expense from "@/models/Expense";
import ExpenseSequence from "@/models/ExpenseSequence";
import BusinessSettings from "@/models/BusinessSettings";

export const runtime = "nodejs";
const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
async function authorize(write = false) {
  const session = await getSession();
  if (!session) return { error: "Please log in to continue.", status: 401 };
  await connectDB();
  const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true }).select("_id role fullName").lean();
  if (!user) return { error: "Your session has expired.", status: 401 };
  if (write && !["admin", "staff"].includes(user.role)) return { error: "You have read-only access to expenses.", status: 403 };
  const company = await Company.findOne({ _id: session.companyId, status: "active" }).select("_id").lean();
  if (!company) return { error: "Company is not active.", status: 403 };
  return { session, user };
}
function safe(x) {
  return { id: String(x._id), expense_number: x.expense_number, expense_date: x.expense_date, note: x.note, items: (x.items || []).map(item => ({ ...item, category: item.category || x.category || "", expense_mode: item.expense_mode || x.expense_mode || "Cash" })), total_amount: x.total_amount, entered_by: String(x.entered_by), entered_by_name: x.entered_by_name, createdAt: x.createdAt, updatedAt: x.updatedAt };
}
function financialYear(date) { const y = date.getFullYear(), start = date.getMonth() >= 3 ? y : y - 1; return `${start}-${String(start + 1).slice(-2)}`; }
async function nextNumber(companyid, date) {
  const fy = financialYear(date);
  const seq = await ExpenseSequence.findOneAndUpdate({ companyid, financial_year: fy }, { $inc: { last_number: 1 }, $setOnInsert: { prefix: "EXP" } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `EXP/${fy}/${String(seq.last_number).padStart(4, "0")}`;
}
async function build(body, a) {
  const date = body.expense_date ? new Date(`${String(body.expense_date).slice(0, 10)}T12:00:00+05:30`) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid expense date.");
  if (!Array.isArray(body.items) || !body.items.length) throw new Error("Add at least one expense item.");
  const setting = await BusinessSettings.findOne({ companyid: a.session.companyId, businessEntry: "expense", title: "Expense Categories", isActive: true }).lean();
  const validCategories = setting?.values || [];
  const items = body.items.map(row => {
    const category = String(row.category || "").trim();
    const expense_name = String(row.expense_name || "").trim();
    const mode = String(row.expense_mode || "");
    const qty = Number(row.qty), rate = Number(row.rate);
    if (!category || !validCategories.includes(category)) throw new Error("Select a valid category for every expense row.");
    if (!expense_name) throw new Error("Enter an expense description for every row.");
    if (!["Cash", "Card", "Online", "UPI"].includes(mode)) throw new Error("Select a valid expense mode for every row.");
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) throw new Error("Check the expense quantity and rate.");
    return { category, expense_name, expense_mode: mode, qty, rate: round(rate), amount: round(qty * rate) };
  });
  return { expense_date: date, note: String(body.note || "").trim().slice(0, 2000), items, total_amount: round(items.reduce((sum, row) => sum + row.amount, 0)), entered_by: a.user._id, entered_by_name: a.user.fullName };
}
export async function GET(req) {
  try {
    const a = await authorize(); if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
    const p = new URL(req.url).searchParams, from = p.get("from"), to = p.get("to"), search = (p.get("search") || "").trim().slice(0, 100);
    const filter = { companyid: a.session.companyId, is_deleted: false };
    if (from || to) { filter.expense_date = {}; if (from) filter.expense_date.$gte = new Date(`${from}T00:00:00+05:30`); if (to) filter.expense_date.$lte = new Date(`${to}T23:59:59.999+05:30`); }
    if (search) { const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ expense_number: rx }, { "items.category": rx }, { "items.expense_mode": rx }, { category: rx }, { expense_mode: rx }, { note: rx }, { entered_by_name: rx }, { "items.expense_name": rx }]; }
    const docs = await Expense.find(filter).sort({ expense_date: -1, createdAt: -1 }).limit(5000).lean();
    return NextResponse.json({ expenses: docs.map(safe), permissions: { canWrite: ["admin", "staff"].includes(a.user.role), canDelete: a.user.role === "admin" }, currentUserName: a.user.fullName });
  } catch (e) { console.error("List expenses failed", e); return NextResponse.json({ error: "Unable to load expenses." }, { status: 500 }); }
}
export async function POST(req) {
  try {
    const a = await authorize(true); if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
    const body = await req.json(), doc = await build(body, a); doc.expense_number = await nextNumber(a.session.companyId, doc.expense_date); doc.companyid = a.session.companyId; doc.created_by = a.user._id;
    const saved = await Expense.create(doc); return NextResponse.json({ message: "Expense saved successfully.", expense: safe(saved) }, { status: 201 });
  } catch (e) { console.error("Create expense failed", e); return NextResponse.json({ error: e.message || "Unable to save expense." }, { status: 400 }); }
}
export async function PUT(req) {
  try {
    const a = await authorize(true); if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
    const body = await req.json(); if (!mongoose.isValidObjectId(body.id)) return NextResponse.json({ error: "Invalid expense." }, { status: 400 });
    const old = await Expense.findOne({ _id: body.id, companyid: a.session.companyId, is_deleted: false }); if (!old) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    const doc = await build(body, a); doc.entered_by = old.entered_by; doc.entered_by_name = old.entered_by_name; Object.assign(old, doc, { updated_by: a.user._id }); await old.save();
    return NextResponse.json({ message: "Expense updated successfully.", expense: safe(old) });
  } catch (e) { console.error("Update expense failed", e); return NextResponse.json({ error: e.message || "Unable to update expense." }, { status: 400 }); }
}
export async function DELETE(req) {
  try {
    const a = await authorize(true); if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
    if (a.user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete expenses." }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id"); if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid expense." }, { status: 400 });
    const doc = await Expense.findOneAndUpdate({ _id: id, companyid: a.session.companyId, is_deleted: false }, { $set: { is_deleted: true, deleted_by: a.user._id, deleted_at: new Date(), updated_by: a.user._id } }, { new: true });
    if (!doc) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    return NextResponse.json({ message: "Expense deleted. Its record is retained for audit history." });
  } catch (e) { console.error("Delete expense failed", e); return NextResponse.json({ error: "Unable to delete expense." }, { status: 500 }); }
}
