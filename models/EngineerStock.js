import mongoose from "mongoose";

// Each document is an immutable issue transaction. Future RMI consumption can
// extend this ledger with additional transaction types without losing history.
const engineerStockSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  engineer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eng_name: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "EngineerStore", required: true, index: true },
  item_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  part_number: { type: String, trim: true, default: "", maxlength: 100 },
  model_number: { type: String, trim: true, default: "", maxlength: 100 },
  issue_qty: { type: Number, required: true, min: 0.000001 },
  issue_date: { type: Date, required: true },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true, strict: "throw" });

engineerStockSchema.index({ companyid:  1, issue_date: -1 });
engineerStockSchema.index({ companyid: 1, engineer_id: 1, item_id: 1, issue_date: -1 });
const EngineerStock = mongoose.models.EngineerStock || mongoose.model("EngineerStock", engineerStockSchema);
export default EngineerStock;
