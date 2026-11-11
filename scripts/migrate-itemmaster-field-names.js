/**
 * One-time compatibility migration for ItemMaster field-name changes.
 * Run from the project root:
 *   node --env-file=.env scripts/migrate-itemmaster-field-names.js
 *
 * New field values are preserved if they already exist. Otherwise, values are
 * copied from the old field names before the old fields are removed.
 * Back up the service-crm database before running this migration.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is missing. Check the .env file.");
  process.exit(1);
}

const renames = [
  ["partnumber", "part_number"],
  ["modelnumber", "model_number"],
  ["purchaseprice", "purchase_price"],
  ["sellingprice", "selling_price"]
];

try {
  await mongoose.connect(uri, { dbName: "service-crm" });
  const items = mongoose.connection.collection("itemmasters");

  for (const [oldName, newName] of renames) {
    // Use an update pipeline so an existing new-name value is never overwritten.
    const result = await items.updateMany(
      { [oldName]: { $exists: true } },
      [
        {
          $set: {
            [newName]: {
              $cond: [
                { $eq: [{ $ifNull: [`$${newName}`, null] }, null] },
                `$${oldName}`,
                `$${newName}`
              ]
            }
          }
        },
        { $unset: oldName }
      ]
    );
    console.log(`${oldName} -> ${newName}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  }

  console.log("ItemMaster field-name migration completed.");
} catch (error) {
  console.error("ItemMaster field-name migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
