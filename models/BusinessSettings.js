import mongoose from "mongoose";
const schema = new mongoose.Schema({ companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true }, businessEntry: { type: String, required: true, trim: true, lowercase: true }, title: { type: String, required: true, trim: true, maxlength: 150 }, values: { type: [String], default: [] }, sortOrder: { type: Number, default: 0 }, isActive: { type: Boolean, default: true } }, { timestamps: true, strict: "throw" });
schema.index({ companyid: 1, businessEntry: 1, title: 1 }, { unique: true });
export default mongoose.models.BusinessSettings || mongoose.model("BusinessSettings", schema);
