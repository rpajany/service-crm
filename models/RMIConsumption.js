import mongoose from "mongoose";

// Each document records one engineer's RMI consumption. Duplicate RMI numbers
// are intentionally allowed because the business approved that rule.
const rmiConsumptionSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  engineer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eng_name: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "EngineerStore", required: true, index: true },
  item_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  part_number: { type: String, trim: true, default: "", maxlength: 100 },
  model_number: { type: String, trim: true, default: "", maxlength: 100 },
  rmi_no: { type: String, required: true, trim: true, maxlength: 100 },
  rmi_qty: { type: Number, required: true, min: 0.000001 },
  rmi_date: { type: Date, required: true },
  consumed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true, strict: "throw" });

rmiConsumptionSchema.index({ companyid: 1, rmi_date: -1 });
rmiConsumptionSchema.index({ companyid: 1, engineer_id: 1, item_id: 1, rmi_date: -1 });
const RMIConsumption = mongoose.models.RMIConsumption || mongoose.model("RMIConsumption", rmiConsumptionSchema);
export default RMIConsumption;
