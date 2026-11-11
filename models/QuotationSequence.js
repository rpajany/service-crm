import mongoose from "mongoose";
const schema = new mongoose.Schema({ companyid: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, financial_year: { type: String, required: true }, prefix: { type: String, default: "QT" }, last_number: { type: Number, default: 0 } }, { timestamps: true });
schema.index({ companyid: 1, financial_year: 1 }, { unique: true });
export default mongoose.models.QuotationSequence || mongoose.model("QuotationSequence", schema);
