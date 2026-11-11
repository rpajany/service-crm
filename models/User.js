import mongoose from "mongoose";

// Users belong to exactly one company in this initial SaaS design.
// Every tenant-owned query must be scoped by companyId on the server.
const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["admin", "engineer", "staff"],
      required: true,
      default: "staff"
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true
    }
  },
  { timestamps: true, strict: "throw" }
);

// A username and email must be unique inside a company, not globally.
// Compound indexes support tenant-scoped uniqueness.
userSchema.index({ companyId: 1, username: 1 }, { unique: true });
userSchema.index({ companyId: 1, email: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
