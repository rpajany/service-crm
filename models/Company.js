import mongoose from "mongoose";

// Each tenant/company gets its own profile document.
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    address: {
      street: { type: String, trim: true, maxlength: 200, default: "" },
      city: { type: String, trim: true, maxlength: 100, default: "" },
      state: { type: String, trim: true, maxlength: 100, default: "" },
      postalCode: { type: String, trim: true, maxlength: 20, default: "" },
      country: { type: String, trim: true, maxlength: 100, default: "" }
    },
    website: { type: String, trim: true, maxlength: 2048, default: "" },
    gstNumber: { type: String, trim: true, maxlength: 50, default: "" },
    logoUrl: { type: String, trim: true, maxlength: 1400000, default: "" },
    companySealUrl: { type: String, trim: true, maxlength: 1400000, default: "" },
    // This field is controlled by trusted platform-level operations only.
    status: {
      type: String,
      enum: ["active", "suspended", "inactive"],
      default: "active",
      required: true
    }
  },
  {
    timestamps: true,
    strict: "throw"
  }
);

const Company =
  mongoose.models.Company || mongoose.model("Company", companySchema);

export default Company;
