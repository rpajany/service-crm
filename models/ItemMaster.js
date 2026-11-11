import mongoose from "mongoose";

// Item codes are unique per company so two CRM tenants can use the same code.
// All business field names are lowercase as requested.
const itemMasterSchema = new mongoose.Schema(
  {
    companyid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    item_code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    part_number: { type: String, trim: true, default: "", maxlength: 100 },
    model_number: { type: String, trim: true, default: "", maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    qty: { type: Number, required: true, min: 0, default: 0 },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    supplier_name: { type: String, trim: true, default: "", maxlength: 200 },
    purchase_price: { type: Number, required: true, min: 0, default: 0 },
    selling_price: { type: Number, required: true, min: 0, default: 0 },
    gst: { type: Number, required: true, min: 0, max: 100, default: 0 },
    hsn_code: { type: String, trim: true, default: "", maxlength: 30 }
  },
  { timestamps: true, strict: "throw" }
);

itemMasterSchema.index({ companyid: 1, item_code: 1 }, { unique: true });
itemMasterSchema.index({ companyid: 1, description: 1 });

const ItemMaster = mongoose.models.ItemMaster || mongoose.model("ItemMaster", itemMasterSchema);
export default ItemMaster;
