import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  supplier_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  supplier_name: { type: String, required: true, trim: true, maxlength: 200 },
  contact_person: { type: String, trim: true, default: "", maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  city: { type: String, trim: true, default: "", maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 2 },
  pincode: { type: String, trim: true, default: "", maxlength: 20 },
  country: { type: String, trim: true, default: "India", maxlength: 100 },
  gstin: { type: String, trim: true, uppercase: true, default: "", maxlength: 20 },
  mobile: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254 },
  remarks: { type: String, trim: true, default: "", maxlength: 1000 }
}, { timestamps: true, strict: "throw" });

supplierSchema.index({ companyid: 1, supplier_code: 1 }, { unique: true });
supplierSchema.index({ companyid: 1, supplier_name: 1 });
const Supplier = mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
export default Supplier;
