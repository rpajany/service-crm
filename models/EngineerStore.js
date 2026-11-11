import mongoose from "mongoose";

// EngineerStore is the shared item catalogue for stock assigned to engineers.
// Its total_qty is the combined quantity held by every engineer in this company.
const engineerStoreSchema = new mongoose.Schema({
  companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemMaster", required: true },
  item_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  part_number: { type: String, trim: true, default: "", maxlength: 100 },
  model_number: { type: String, trim: true, default: "", maxlength: 100 },
  total_qty: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true, strict: "throw" });

engineerStoreSchema.index({ companyid: 1, item_id: 1 }, { unique: true });
const EngineerStore = mongoose.models.EngineerStore || mongoose.model("EngineerStore", engineerStoreSchema);
export default EngineerStore;
