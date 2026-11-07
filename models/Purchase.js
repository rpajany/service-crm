import mongoose from "mongoose";
const purchaseItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemMaster", required: true },
  item_code: { type: String, trim: true, default: "" }, description: { type: String, required: true, trim: true },
  part_number: { type: String, trim: true, default: "" }, model_number: { type: String, trim: true, default: "" }, hsn_code: { type: String, trim: true, default: "" },
  qty: { type: Number, required: true, min: 0.001 }, purchase_price: { type: Number, required: true, min: 0 },
  discount_percent: { type: Number, min: 0, max: 100, default: 0 }, discount_amount: { type: Number, min: 0, default: 0 },
  taxable_amount: { type: Number, required: true, min: 0 }, gst_rate: { type: Number, min: 0, max: 100, default: 0 },
  cgst: { type: Number, default: 0 }, sgst: { type: Number, default: 0 }, igst: { type: Number, default: 0 }, total_amount: { type: Number, required: true, min: 0 }
}, { _id: false });
const paymentEntrySchema = new mongoose.Schema({
  payment_date: { type: Date, required: true },
  payment_method: { type: String, enum: ["Cash", "Cheque", "UPI", "Online"], required: true },
  payment_amount: { type: Number, required: true, min: 0.01 },
  balance_amount: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, default: "", maxlength: 1000 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });
const purchaseSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  purchase_number: { type: String, required: true, trim: true }, supplier_invoice_number: { type: String, trim: true, default: "" },
  supplier_invoice_date: { type: Date, default: null }, purchase_date: { type: Date, required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  supplier_snapshot: { supplier_code: String, supplier_name: String, contact_person: String, address: String, city: String, state: String, pincode: String, country: String, gstin: String, mobile: String, email: String },
  place_of_supply: { state_code: String, state_name: String }, gst_type: { type: String, enum: ["intra-state", "inter-state"], required: true },
  items: { type: [purchaseItemSchema], required: true, validate: v => v.length > 0 },
  total_qty: { type: Number, default: 0 }, total_discount: { type: Number, default: 0 }, total_taxable_amount: { type: Number, default: 0 },
  total_cgst: { type: Number, default: 0 }, total_sgst: { type: Number, default: 0 }, total_igst: { type: Number, default: 0 }, grand_total: { type: Number, default: 0 },
  amount_paid: { type: Number, default: 0, min: 0 }, payment_method: { type: String, enum: ["", "Cash", "Cheque", "UPI", "Online"], default: "" },
  balance_amount: { type: Number, default: 0, min: 0 }, payment_note: { type: String, trim: true, default: "" },
  payment_history: { type: [paymentEntrySchema], default: [] },
  status: { type: String, enum: ["Open", "Cancelled"], default: "Open", index: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, cancelled_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, cancelled_at: Date
}, { timestamps: true, strict: "throw" });
purchaseSchema.index({ companyid: 1, purchase_number: 1 }, { unique: true });
purchaseSchema.index({ companyid: 1, purchase_date: -1 });
export default mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
