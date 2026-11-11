import mongoose from "mongoose";
const quotationItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemMaster", default: null },
  item_code: { type: String, trim: true, default: "" }, description: { type: String, required: true, trim: true, maxlength: 500 },
  hsn_code: { type: String, trim: true, default: "" }, model_number: { type: String, trim: true, default: "" },
  quantity: { type: Number, required: true, min: 0.001 }, rate: { type: Number, required: true, min: 0 }, gst_rate: { type: Number, required: true, min: 0, max: 100 },
  taxable_amount: { type: Number, required: true, min: 0 }, cgst: { type: Number, default: 0 }, sgst: { type: Number, default: 0 }, igst: { type: Number, default: 0 }, total_amount: { type: Number, required: true, min: 0 }
}, { _id: true });
const quotationSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true }, quotation_number: { type: String, required: true, trim: true },
  quotation_date: { type: Date, required: true }, reference_number: { type: String, trim: true, default: "" }, kind_attention: { type: String, trim: true, default: "" },
  model_number: { type: String, trim: true, default: "" }, serial_number: { type: String, trim: true, default: "" }, job_number: { type: String, trim: true, default: "" },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true }, customer_snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  company_snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, place_of_supply: { type: mongoose.Schema.Types.Mixed, default: {} },
  items: { type: [quotationItemSchema], validate: (v) => v.length > 0 }, not_in_scope: { type: String, trim: true, default: "" },
  terms_sections: { type: [mongoose.Schema.Types.Mixed], default: [] }, total_taxable: { type: Number, default: 0 }, total_cgst: { type: Number, default: 0 }, total_sgst: { type: Number, default: 0 }, total_igst: { type: Number, default: 0 }, grand_total: { type: Number, default: 0 },
  status: { type: String, enum: ["Open", "Closed", "Cancelled", "Pending", "Rejected"], default: "Open", required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true, strict: "throw" });
quotationSchema.index({ companyid: 1, quotation_number: 1 }, { unique: true });
quotationSchema.index({ companyid: 1, quotation_date: -1 });
export default mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema);
