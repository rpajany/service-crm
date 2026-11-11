import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import ItemMaster from "../models/ItemMaster.js";
import StockMovement from "../models/StockMovement.js";

// One-time backfill for items that existed before Stock Summary was introduced.
// It is safe to re-run: items that already have any stock movement are skipped.
async function main() {
  await connectDB();
  const items = await ItemMaster.find({}).lean();
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    const exists = await StockMovement.exists({ companyid: item.companyid, item_id: item._id });
    if (exists) {
      skipped += 1;
      continue;
    }

    const qty = Number(item.qty || 0);
    await StockMovement.create({
      companyid: item.companyid,
      item_id: item._id,
      transaction_type: "itemmaster",
      invoice_number: "",
      invoice_date: item.createdAt || new Date(),
      item_code: item.item_code,
      item_name: item.description,
      part_number: item.part_number || "",
      model_number: item.model_number || "",
      stock_qty: 0,
      transact_qty: qty,
      hand_stock_qty: qty,
      remarks: "ItemMaster Add - Opening Stock (Migration)"
    });
    inserted += 1;
  }

  console.log(`Stock movement backfill complete. Inserted: ${inserted}; skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error("Stock movement backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
