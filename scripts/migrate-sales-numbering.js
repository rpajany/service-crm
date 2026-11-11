import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";

// Run once before deploying the GST / Non-GST sequence update.
// Existing SalesSequence records are treated as GST sequences so historical
// invoice counters continue instead of restarting or being reused.
async function main() {
  await connectDB();
  const sequenceCollection = mongoose.connection.collection("salessequences");
  const indexes = await sequenceCollection.indexes();
  const legacyIndex = indexes.find((index) => index.name === "companyid_1_financial_year_1");
  if (legacyIndex) await sequenceCollection.dropIndex(legacyIndex.name);

  const sequenceResult = await sequenceCollection.updateMany(
    { gst_status: { $exists: false } },
    [
      { $set: {
        gst_status: "GST",
        prefix: "SAL-GST",
        starting_number: { $add: [{ $ifNull: ["$last_number", 0] }, 1] },
        numbering_policy: "continuous"
      } }
    ]
  );

  const salesResult = await mongoose.connection.collection("sales").updateMany(
    { gst_status: { $exists: false } },
    { $set: { gst_status: "GST" } }
  );

  await sequenceCollection.createIndex(
    { companyid: 1, financial_year: 1, gst_status: 1 },
    { unique: true, name: "companyid_1_financial_year_1_gst_status_1" }
  );

  console.log(`Sales numbering migration complete. Sequences updated: ${sequenceResult.modifiedCount}; Sales bills updated: ${salesResult.modifiedCount}.`);
}

main()
  .catch((error) => {
    console.error("Sales numbering migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
