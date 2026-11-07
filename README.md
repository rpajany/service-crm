# Service CRM — Version 3

A starter SaaS CRM for computer hardware service shops built with Next.js App Router, JavaScript, MongoDB/Mongoose, `jose` JWT sessions, `bcryptjs`, Zod validation, and Tailwind-like custom CSS.

## Included in this version

- Controlled company onboarding protected by `BOOTSTRAP_SECRET`.
- First company admin is created with the company; password is hashed.
- Login/logout using a signed JWT in an HTTP-only cookie.
- Roles: `admin`, `engineer`, `staff`.
- Protected dashboard and company profile.
- Company profile can only be read/updated by an authenticated admin belonging to that company.
- Collapsed icon-only sidebar that expands on mouse hover/focus and shows icons with menu names.
- Server-side validation and company-scoped database access.
- Customer CRUD module with a reusable Add/Edit Customer modal, search, pagination, and Excel-compatible CSV export.
- Customer records are tenant-scoped and require customer name, address, and mobile number.
- Company seal image upload stored in the Company document as `companySealUrl` (PNG, JPEG, or WebP, up to 1 MB).
- Stock Summary date filters default to the current calendar month and remain editable.
- Data table headers use a gray background with white text.
- Commented code for learning.

## Requirements

- Node.js 20.9+ recommended.
- MongoDB running locally on `127.0.0.1:27017`, or another MongoDB URI.
- npm.

## Setup

1. Copy `.env.example` to `.env` in the project root.
2. Set `MONGODB_URI`, `JWT_SECRET`, and `BOOTSTRAP_SECRET` to appropriate values.
   - `JWT_SECRET` should be a strong random secret of at least 32 characters.
   - `BOOTSTRAP_SECRET` should be a different strong random value. It acts like an onboarding key; do not share it publicly.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000/setup` to create the first company and its admin user.
6. Sign in at `http://localhost:3000/login`.

## Company onboarding safety

The onboarding endpoint requires `BOOTSTRAP_SECRET` and refuses to create a company if that company slug already exists. Keep the secret private. In a real production deployment, expose company creation only through a platform-admin workflow or a verified subscription/onboarding process. Do not leave an easily guessable bootstrap secret in production.

The bootstrap endpoint creates the company and its first admin inside a MongoDB transaction when connected to a replica set or supported sharded cluster. Both writes then commit together or are rolled back together.

For local development, a standard standalone MongoDB server does not support multi-document transactions. The API detects this topology and uses a compatibility path: it creates the company, creates the admin, and attempts to delete the company if admin creation fails. This fallback is best-effort cleanup, not strict atomicity; a process crash can interrupt cleanup. If you want transaction guarantees locally, configure MongoDB as a single-node replica set. No database fields or models are added for this behavior.

## Important production checklist before public deployment

- Set `COOKIE_SECURE=true` behind HTTPS.
- Use strong unique secrets; rotate them through your deployment secret manager.
- Configure MongoDB authentication and network allow-listing; do not expose port 27017 publicly.
- Add rate limiting/WAF protection to login and onboarding endpoints.
- Add email verification, password reset, audit logs, monitoring, backups, and subscription billing before commercial launch.
- Review privacy, data retention, and legal requirements for your target markets.
- Add automated tests and a deployment pipeline.
- The starter uses a one-hour JWT cookie. A production rollout should also include a revocation/session-version strategy and CSRF protections appropriate to the chosen deployment topology.

## Sidebar behavior

The sidebar is narrow and icon-only by default. Hover over it or keyboard-focus it to expand and show menu labels. On touch devices, use the menu button to toggle expansion.

## Notes

This is a versioned starter project, not a substitute for a security review before handling real customer data. The included profile endpoint uses an allow-list so clients cannot change company status or other platform-controlled fields.


## GST field update and existing data

Company onboarding and profile validation use `company.gstNumber` / `gstNumber`; the field is optional and defaults to an empty string. The API returns field-specific validation paths such as `company.name` and `admin.email`.

If your database contains older company documents with `taxNumber`, back up the database first, then run this one-time migration from the project root after installing dependencies and configuring `.env`:

```bash
node --env-file=.env scripts/migrate-tax-number-to-gst-number.js
```

The migration preserves an existing non-empty `gstNumber`, copies `taxNumber` only when `gstNumber` is empty/missing, and then removes the old `taxNumber` field. It uses the configured `MONGODB_URI` and explicitly targets the `service-crm` database.

## Company profile logo upload

Company admins can upload a company logo from **Company Profile**. The logo is stored as a Base64 data URL in the existing `Company.logoUrl` field; no database field or external storage service is added. PNG, JPEG, and WebP images up to 1 MB are accepted. The API validates the encoded image size and checks its file signature before saving. Existing HTTPS logo URLs remain supported.

Because encoded images are larger than their original files, keep uploaded logos small (up to 1 MB). For production environments, configure the hosting platform's request-body limit to allow the approximately 1.4 MB JSON payload plus the other profile fields.

## ItemMaster module

The ItemMaster module is available from the sidebar at **ItemMaster**. It provides company-scoped item CRUD, text search, pagination, and an Excel-compatible UTF-8 CSV export of the current search results. Excel can open the exported `.csv` file directly.

### Item fields

The Mongoose model uses lowercase field names: `item_code`, `part_number`, `model_number`, `description`, `qty`, `supplier_name`, `purchase_price`, `selling_price`, `gst`, and `hsn_code`. Item codes are unique within each company. Quantity and prices cannot be negative; GST must be from 0 to 100. Supplier name is stored as text for now.

### Reusing the ItemMaster modal

Import `ItemMasterModal` from `@/app/components/item-master/ItemMasterModal` into a client component. Provide `isOpen`, `item` (null to create, an item object to edit), and `onClose`. `onSaved` receives the saved item. For Purchase/Sales item lookup, pass `selectionMode={true}` and `onSelect={(item) => ...}`; the modal then shows a searchable company-scoped item picker and also allows creating a new item.

All API reads and writes derive `companyid` from the authenticated session. Admin and staff roles can create, update, and delete; engineers can view items only. The API never trusts a company ID supplied by the browser.

### ItemMaster field-name update

ItemMaster now uses `part_number`, `model_number`, `purchase_price`, and `selling_price` consistently in the Mongoose model, API, reusable modal, and table/export UI. If your database already contains ItemMaster records created by an older version, back up the `service-crm` database and run this one-time migration from the project root:

```bash
node --env-file=.env scripts/migrate-itemmaster-field-names.js
```

The migration copies values from legacy names only when the new field is missing, then removes the old field names. It does not add any new fields to the schema beyond the four approved name changes.


## Stock Summary and ItemMaster stock history

The Stock Summary page is available from the sidebar. It displays append-only stock movement records and a separate current-stock table sourced from `ItemMaster.qty`. New ItemMaster records create an `itemmaster` movement (including a zero opening quantity); editing an item's quantity appends a signed quantity-adjustment movement instead of replacing prior history. The report supports From/To Date, search, transaction-type filtering, pagination, and Excel-compatible CSV exports.

Existing items created before Stock Summary was added will not automatically have history rows. Back up your database, configure `.env`, then run this one-time, idempotent backfill from the project root:

```bash
npm run backfill:stock-movements
```

Purchase/Sales invoice posting is not implemented yet. The shared `StockMovement` model is prepared for those modules; invoice edits should retain prior movements and append compensating reversal/new movement rows rather than deleting history. The current manual adjustment endpoint updates `ItemMaster.qty` and appends a movement, and should be used only by authorized staff/admins.

## Customer State and GST State Codes

- Reusable current Indian State/UT data lives in `lib/indian-states.js`.
- `INDIAN_STATES` contains current Indian State/UT entries with GST codes stored as strings to preserve leading zeroes.
- `GST_SPECIAL_CODES` keeps special entries separate from the ordinary State dropdown.
- Customer `state` stores the selected GST state code. `place_of_supply` stores the applicable state code when set; new customers default to the company registered state when it is configured.
- The Company Profile State field uses the same shared State/UT list. GST calculation on invoices must still apply the relevant GST place-of-supply rules; this customer master change does not itself calculate invoice tax.


## Supplier module (v12)

- Supplier records are stored in the `Supplier` Mongoose model and scoped to the authenticated company.
- Admin and staff can create, edit, and delete suppliers; engineers can view them.
- Supplier codes are generated automatically (`SUP-00001`, etc.) per company.
- The reusable form is `app/components/suppliers/SupplierModal.js`.
- The Supplier page is available from the sidebar at `/suppliers`, with search, pagination, CRUD actions, and Excel-compatible CSV export.
- ItemMaster now has a supplier autocomplete that searches supplier name, GSTIN, and mobile. Selecting a result stores the supplier reference and supplier-name snapshot. The adjacent **Add Supplier** button opens the reusable supplier modal.
- Export buttons should use the shared `.btn btn-export` CSS class, which sets the background color to `#06b15b`. Use this class for future export actions too.

## Quotation module (Version 13)

- Company-scoped quotation creation, editing (Open quotations only), status updates, deletion, date/search filters, pagination, and Excel-compatible CSV export.
- Quotation numbers are generated by financial year (`QT/YYYY-YY/0001`) with a company-specific atomic sequence.
- ItemMaster selection and manual item entry are supported. GST is calculated per line, using CGST+SGST for intra-state supplies and IGST for inter-state supplies based on the company registered state and selected place of supply.
- Customer and company information, item details, tax totals, and terms are snapshotted into each quotation.
- Quotation defaults can be maintained under Settings. Existing quotation snapshots are not changed when defaults are later edited.
- Printing uses the browser print dialog; select a physical printer or Save as PDF.
- A shared confirmation modal is used for deletion across Customer, Supplier, ItemMaster, Settings, and Quotations. Shared toast notifications provide application-level feedback.

## Purchase module (Version 15)

The Purchases page is available from the sidebar. It uses the existing Supplier and ItemMaster records and creates two new MongoDB collections automatically: `purchases` and `purchasesequences`.

- Internal purchase number format: `PUR/YYYY-YY/0001`; the supplier's invoice number and date are stored separately.
- Purchase date defaults to the current local date.
- Item-wise discount percentage/amount and GST are calculated on the discounted taxable value. CGST/SGST is selected when Place of Supply matches the company's registered state; otherwise IGST is used.
- Amount Paid may be partial; the balance is calculated automatically.
- Saving a purchase increases ItemMaster stock and appends `purchase` StockMovement records.
- Editing an open purchase applies only the stock quantity difference and appends stock movements.
- Cancelling an open purchase appends negative `reversal` movements and reduces ItemMaster stock. Cancellation is rejected if it would make any item's stock negative. Historical purchases and ledger rows are retained.
- The purchase list supports date filters, search, pagination and CSV export compatible with Excel.
- Payment Tracking is available from the Purchase table Action column. Each payment stores its date, payment type (Cash/Cheque/UPI/Online), amount, balance after payment and notes. The bill keeps a running paid amount and outstanding balance, and rejects payments above the balance. The payment history remains attached to the purchase. Existing purchases with an earlier Amount Paid value are shown as a legacy payment and are carried into the history when a new payment is added.
- The Sales module is not included in this Version 15 project, so Sales payment tracking cannot be attached to a Sales bill yet. The same payment-history design can be applied when the Sales module is added.

No manual database migration is required for the two new collections; Mongoose creates them when the module is first used. Back up the database before testing purchase edits or cancellation.

## Sales module (Version 18)
- Sales bills use company-scoped `Sales` and `SalesSequence` collections. Bill numbers follow `SAL/YYYY-YY/0001` financial-year numbering.
- Sales uses Customer and ItemMaster masters, GST place-of-supply calculation, discounts, partial payments, payment history, and Sales Terms & Conditions configured separately in Settings.
- Saving a sale reduces ItemMaster stock and writes an append-only `sales` StockMovement. Editing records stock deltas as `sales` or `reversal`; cancelling restores stock through `reversal` movements. Sales cannot reduce stock below zero.
- Sales bill print preview uses the existing A4 quotation print styling and includes company/customer snapshots, item/tax totals, payment summary, terms, logo and seal.
- The Settings page now has separate Quotation and Sales Terms & Conditions sections. Existing quotation settings remain in the `quotation` business entry; Sales terms use the `sales` business entry.


## Version 30 — GST / Non-GST Sales numbering

Before starting the updated application against an existing database, take a database backup and run the one-time migration:

```bash
npm run migrate:sales-numbering
```

This migration converts existing Sales records and the existing Sales sequence to GST, and replaces the old sequence unique index with a company + financial year + GST status index. Existing bills remain GST bills and keep their existing numbers.

After migration, open Settings → Sales Bill Numbering to configure GST and Non-GST sequences for the current financial year. Policy choices are Continuous, Reset to 1, or Custom starting number (0 is treated as 1). Numbering settings lock after a bill is issued in that sequence for the financial year.
