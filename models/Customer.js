import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  customer_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  customer_name: { type: String, required: true, trim: true, maxlength: 200 },
  contact_person: { type: String, trim: true, default: "", maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  city: { type: String, trim: true, default: "", maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 2 },
  place_of_supply: { type: String, trim: true, default: "", maxlength: 2 },
  pincode: { type: String, trim: true, default: "", maxlength: 20 },
  country: { type: String, trim: true, default: "India", maxlength: 100 },
  gstin: { type: String, trim: true, uppercase: true, default: "", maxlength: 20 },
  mobile: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254 },
  remarks: { type: String, trim: true, default: "", maxlength: 1000 }
}, { timestamps: true, strict: "throw" });

customerSchema.index({ companyid: 1, customer_code: 1 }, { unique: true });
customerSchema.index({ companyid: 1, customer_name: 1 });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;
