import mongoose from "mongoose";

const expenseItemSchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true, maxlength: 150 },
  expense_name: { type: String, required: true, trim: true, maxlength: 250 },
  expense_mode: { type: String, enum: ["Cash", "Card", "Online", "UPI"], required: true },
  qty: { type: Number, required: true, min: 0.001, default: 1 },
  rate: { type: Number, required: true, min: 0, default: 0 },
  amount: { type: Number, required: true, min: 0, default: 0 }
}, { _id: false });

const schema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  expense_number: { type: String, required: true, trim: true },
  expense_date: { type: Date, required: true },
  // Kept optional for compatibility with older vouchers; new vouchers store these per item.
  category: { type: String, trim: true, maxlength: 150 },
  expense_mode: { type: String, enum: ["Cash", "Card", "Online", "UPI"] },
  note: { type: String, trim: true, default: "", maxlength: 2000 },
  items: { type: [expenseItemSchema], required: true, validate: v => v.length > 0 },
  total_amount: { type: Number, required: true, min: 0 },
  entered_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  entered_by_name: { type: String, required: true, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  is_deleted: { type: Boolean, default: false, index: true },
  deleted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deleted_at: { type: Date }
}, { timestamps: true, strict: "throw" });

schema.index({ companyid: 1, expense_number: 1 }, { unique: true });
schema.index({ companyid: 1, expense_date: -1, is_deleted: 1 });
export default mongoose.models.Expense || mongoose.model("Expense", schema);
