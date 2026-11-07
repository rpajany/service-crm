import mongoose from "mongoose";

// Append-only stock ledger. Purchase/Sales can use this same model later;
// invoice edits should add reversal/new entries rather than erase old history.
const stockMovementSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemMaster", required: true, index: true },
  transaction_type: { type: String, enum: ["itemmaster", "purchase", "sales", "adjustment", "reversal", "engineer_issue"], required: true, index: true },
  engineer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  invoice_number: { type: String, trim: true, default: "", maxlength: 100 },
  invoice_date: { type: Date, required: true, index: true },
  item_code: { type: String, trim: true, default: "", maxlength: 80 },
  item_name: { type: String, trim: true, required: true, maxlength: 500 },
  part_number: { type: String, trim: true, default: "", maxlength: 100 },
  model_number: { type: String, trim: true, default: "", maxlength: 100 },
  stock_qty: { type: Number, required: true },
  // Signed quantity: positive adds stock; negative removes stock.
  transact_qty: { type: Number, required: true },
  hand_stock_qty: { type: Number, required: true, min: 0 },
  remarks: { type: String, trim: true, default: "", maxlength: 500 },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

stockMovementSchema.index({ companyid: 1, invoice_date: -1, created_at: -1 });
stockMovementSchema.index({ companyid: 1, item_id: 1, created_at: -1 });

const StockMovement = mongoose.models.StockMovement || mongoose.model("StockMovement", stockMovementSchema);
export default StockMovement;
