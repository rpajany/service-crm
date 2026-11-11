/**
 * One-time compatibility migration for older Company documents.
 * Run from the project root: node --env-file=.env scripts/migrate-tax-number-to-gst-number.js
 * Existing gstNumber values are preserved; taxNumber is copied only when GST is blank/missing.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is missing. Check the .env file.");
  process.exit(1);
}

try {
  await mongoose.connect(uri, { dbName: "service-crm" });
  const companies = mongoose.connection.collection("companies");
  const result = await companies.updateMany(
    { taxNumber: { $exists: true } },
    [
      {
        $set: {
          gstNumber: {
            $cond: [
              { $or: [{ $eq: [{ $ifNull: ["$gstNumber", ""] }, ""] }, { $eq: ["$gstNumber", null] }] },
              { $ifNull: ["$taxNumber", ""] },
              "$gstNumber"
            ]
          }
        }
      },
      { $unset: "taxNumber" }
    ]
  );
  console.log(`Migration complete. Matched ${result.matchedCount} company document(s); modified ${result.modifiedCount}.`);
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
