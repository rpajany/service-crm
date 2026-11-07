import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Company from "@/models/Company";
import Customer from "@/models/Customer";
import ItemMaster from "@/models/ItemMaster";
import StockMovement from "@/models/StockMovement";
import Sales from "@/models/Sales";
import SalesSequence from "@/models/SalesSequence";
import { getIndianStateCode, getIndianStateLabel } from "@/lib/indian-states";
export const runtime = "nodejs";
const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
async function authorize(write = false) {
 const session = await getSession(); if (!session) return { error: "Please log in to continue.", status: 401 }; await connectDB();
 const user = await User.findOne({ _id: session.userId, companyId: session.companyId, isActive: true }).select("_id role").lean(); if (!user) return { error: "Your account is inactive or your session has expired.", status: 401 };
 const company = await Company.findOne({ _id: session.companyId, status: "active" }).lean(); if (!company) return { error: "Company is not active.", status: 403 };
 if (write && !["admin", "staff"].includes(user.role)) return { error: "You have read-only access to sales.", status: 403 }; return { session, user, company };
}
function safe(p) { const x = p.toObject ? p.toObject() : p; return { id:String(x._id),sales_number:x.sales_number,gst_status:x.gst_status||"GST",replacement_sales_id:x.replacement_sales_id?String(x.replacement_sales_id):null,replaced_sales_id:x.replaced_sales_id?String(x.replaced_sales_id):null,cancel_reason:x.cancel_reason||"",reference_number:x.reference_number,sales_date:x.sales_date,customer_id:String(x.customer_id),company_snapshot:x.company_snapshot,customer_snapshot:x.customer_snapshot,place_of_supply:x.place_of_supply,gst_type:x.gst_type,items:(x.items||[]).map(i=>({...((i.toObject?i.toObject():i)),item_id:String(i.item_id)})),total_qty:x.total_qty,total_discount:x.total_discount,total_taxable_amount:x.total_taxable_amount,total_cgst:x.total_cgst,total_sgst:x.total_sgst,total_igst:x.total_igst,grand_total:x.grand_total,amount_paid:x.amount_paid,payment_method:x.payment_method,balance_amount:x.balance_amount,payment_note:x.payment_note,payment_history:(x.payment_history||[]).map(v=>({id:String(v._id),payment_date:v.payment_date,payment_method:v.payment_method,payment_amount:v.payment_amount,balance_amount:v.balance_amount,notes:v.notes,createdAt:v.createdAt})),terms_snapshot:x.terms_snapshot||[],status:x.status,createdAt:x.createdAt,updatedAt:x.updatedAt}; }
function financialYear(date) { const y = date.getFullYear(), start = date.getMonth() >= 3 ? y : y - 1; return `${start}-${String(start + 1).slice(-2)}`; }
async function nextNumber(companyid, date, gstStatus="GST") {
 const fy=financialYear(date), filter={companyid,financial_year:fy,gst_status:gstStatus};
 let seq=await SalesSequence.findOne(filter);
 let legacy=null;
 if(!seq){
  const previousYear=Number(fy.slice(0,4))-1;
  const previousFy=`${previousYear}-${String(previousYear+1).slice(-2)}`;
  const previous=await SalesSequence.findOne({companyid,financial_year:previousFy,gst_status:gstStatus}).lean();
  legacy= gstStatus==="GST" ? await SalesSequence.findOne({companyid,financial_year:fy,gst_status:{$exists:false}}).lean() : null;
  const policy="continuous",start=legacy ? Number(legacy.last_number||0)+1 : 1;
  const initialLast=legacy ? Number(legacy.last_number||0) : (previous?.last_number||0);
  try { seq=await SalesSequence.create({...filter,prefix:gstStatus==="GST"?"SAL-GST":"SAL-NGST",last_number:initialLast,starting_number:start,numbering_policy:policy}); }
  catch(e){if(e?.code!==11000)throw e;seq=await SalesSequence.findOne(filter);}
 }
 if(Number(seq.last_number||0)===0){
  let base=0;
  if(seq.numbering_policy==="reset")base=0;
  else if(seq.numbering_policy==="custom")base=Math.max(0,Number(seq.starting_number||1)-1);
  else {const y=Number(fy.slice(0,4))-1,prevFy=`${y}-${String(y+1).slice(-2)}`,prev=await SalesSequence.findOne({companyid,financial_year:prevFy,gst_status:gstStatus}).lean();base=Number(prev?.last_number||0);if(!base)base=legacy?Number(legacy.last_number||0):0;}
  if(base>0||seq.numbering_policy!=="continuous")await SalesSequence.updateOne({...filter,last_number:0},{$set:{last_number:base}});
  seq.last_number=base;
 }
 const result=await SalesSequence.findOneAndUpdate({...filter,last_number:seq.last_number},{$inc:{last_number:1}},{new:true});
 if(!result) return nextNumber(companyid,date,gstStatus);
 return `SAL-${gstStatus==="GST"?"GST":"NGST"}/${fy}/${String(result.last_number).padStart(4,"0")}`;
}
async function build(body, auth) {
 if (!mongoose.isValidObjectId(body.customer_id)) throw new Error("Select a valid customer.");
 const customer = await Customer.findOne({ _id: body.customer_id, companyid: auth.session.companyId }).lean(); if (!customer) throw new Error("Customer not found in your company.");
 const date = body.sales_date ? new Date(`${String(body.sales_date).slice(0,10)}T12:00:00+05:30`) : new Date(); if (Number.isNaN(date.getTime())) throw new Error("Enter a valid sales date.");
 const gstStatus=body.gst_status==="Non-GST"?"Non-GST":"GST"; const companyState = getIndianStateCode(auth.company.address?.state || ""); const pos = String(body.place_of_supply?.state_code || getIndianStateCode(customer.state) || ""); if (!pos) throw new Error("Select a valid Place of Supply state."); const intra = !!companyState && companyState === pos;
 if (!Array.isArray(body.items) || !body.items.length) throw new Error("Add at least one sales item.");
 let total_qty=0,total_discount=0,total_taxable_amount=0,total_cgst=0,total_sgst=0,total_igst=0; const items=[];
 for (const raw of body.items) {
  if (!mongoose.isValidObjectId(raw.item_id)) throw new Error("Select a valid ItemMaster item for every line.");
  const master = await ItemMaster.findOne({ _id: raw.item_id, companyid: auth.session.companyId }); if (!master) throw new Error("An item was not found in your company.");
  const qty=Number(raw.qty), price=Number(raw.selling_price), percent=Number(raw.discount_percent||0), gross=round(qty*price);
  if (!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<0||!Number.isFinite(percent)||percent<0||percent>100) throw new Error("Check item quantity, sales price and discount.");
  const discount = raw.discount_amount !== undefined && raw.discount_amount !== "" ? Number(raw.discount_amount) : round(gross*percent/100);
  if (!Number.isFinite(discount)||discount<0||discount>gross) throw new Error("Discount amount cannot exceed the line amount.");
  const gst=gstStatus==="Non-GST"?0:Number(raw.gst_rate ?? master.gst); if (!Number.isFinite(gst)||gst<0||gst>100) throw new Error("Invalid GST rate.");
  const taxable=round(gross-discount), tax=gstStatus==="Non-GST"?0:round(taxable*gst/100), cgst=intra?round(tax/2):0, sgst=intra?round(tax-cgst):0, igst=intra?0:tax;
  items.push({ item_id:master._id,item_code:master.item_code,description:master.description,part_number:master.part_number,model_number:master.model_number,hsn_code:master.hsn_code,qty,selling_price:price,discount_percent:percent,discount_amount:round(discount),taxable_amount:taxable,gst_rate:gst,cgst,sgst,igst,total_amount:round(taxable+tax) });
  total_qty+=qty; total_discount+=discount; total_taxable_amount+=taxable; total_cgst+=cgst; total_sgst+=sgst; total_igst+=igst;
 }
 const grand=round(total_taxable_amount+total_cgst+total_sgst+total_igst), paid=Number(body.amount_paid||0); if (!Number.isFinite(paid)||paid<0||paid>grand) throw new Error("Amount Paid must be between zero and the Grand Total.");
 const method=String(body.payment_method||""); if (paid>0 && !["Cash","Cheque","UPI","Online"].includes(method)) throw new Error("Select a payment method when an amount is paid.");
 return { gst_status:gstStatus, reference_number:String(body.reference_number||"").trim().slice(0,100),company_snapshot:{name:auth.company.name,email:auth.company.email,phone:auth.company.phone,website:auth.company.website,gstNumber:auth.company.gstNumber,logoUrl:auth.company.logoUrl,companySealUrl:auth.company.companySealUrl,address:auth.company.address},sales_date:date,customer_id:customer._id,customer_snapshot:{customer_code:customer.customer_code,customer_name:customer.customer_name,contact_person:customer.contact_person,address:customer.address,city:customer.city,state:customer.state,pincode:customer.pincode,country:customer.country,gstin:customer.gstin,mobile:customer.mobile,email:customer.email},place_of_supply:{state_code:pos,state_name:getIndianStateLabel(pos)||pos},gst_type:intra?"intra-state":"inter-state",items,total_qty:round(total_qty),total_discount:round(total_discount),total_taxable_amount:round(total_taxable_amount),total_cgst:round(total_cgst),total_sgst:round(total_sgst),total_igst:round(total_igst),grand_total:grand,amount_paid:round(paid),payment_method:method,balance_amount:round(grand-paid),payment_note:String(body.payment_note||"").trim().slice(0,1000),terms_snapshot:Array.isArray(body.terms_snapshot)?body.terms_snapshot:[] };
}
// Apply stock deltas with append-only movements. If a later operation fails, compensate prior changes.
async function applyDeltas(companyid, deltas, invoice, date, remarks) {
 const applied=[];
 try {
  for (const [itemId, delta] of deltas) {
   if (!delta) continue;
   const filter={_id:itemId,companyid}; if (delta<0) filter.qty={$gte:-delta};
   const beforeItem=await ItemMaster.findOneAndUpdate(filter,{$inc:{qty:delta}},{new:false});
   if (!beforeItem) throw new Error(delta<0?`Insufficient stock for item ${itemId}; sales cannot reduce stock below zero.`:"An ItemMaster item was not found.");
   const after=round(Number(beforeItem.qty)+delta);
   const appliedEntry={itemId,delta,movementId:null}; applied.push(appliedEntry);
   const movement=await StockMovement.create({companyid,item_id:itemId,transaction_type:delta<0?"sales":"reversal",invoice_number:invoice,invoice_date:date,item_code:beforeItem.item_code,item_name:beforeItem.description,part_number:beforeItem.part_number,model_number:beforeItem.model_number,stock_qty:beforeItem.qty,transact_qty:delta,hand_stock_qty:after,remarks});
   appliedEntry.movementId=movement._id;
  }
  return applied;
 } catch(e) {
  for (const a of applied.reverse()) { await ItemMaster.updateOne({_id:a.itemId,companyid},{$inc:{qty:-a.delta}}); if(a.movementId) await StockMovement.deleteOne({_id:a.movementId,companyid}); }
  throw e;
 }
}
function aggregateItems(rows) { const map=new Map(); for(const r of rows||[]) { const id=String(r.item_id); map.set(id,(map.get(id)||0)+Number(r.qty||0)); } return map; }
function diffItems(oldRows,newRows) { const a=aggregateItems(oldRows),b=aggregateItems(newRows),ids=new Set([...a.keys(),...b.keys()]); return [...ids].map(id=>[id,round((a.get(id)||0)-(b.get(id)||0))]).filter(x=>x[1]!==0); }
export async function GET(req) { try { const a=await authorize(); if(a.error)return NextResponse.json({error:a.error},{status:a.status}); const p=new URL(req.url).searchParams,from=p.get("from"),to=p.get("to"),search=(p.get("search")||"").trim().slice(0,100),filter={companyid:a.session.companyId}; if(from||to){filter.sales_date={};if(from)filter.sales_date.$gte=new Date(`${from}T00:00:00+05:30`);if(to)filter.sales_date.$lte=new Date(`${to}T23:59:59.999+05:30`);} if(search){const rx=new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");filter.$or=[{sales_number:rx},{reference_number:rx},{"customer_snapshot.customer_name":rx},{"customer_snapshot.mobile":rx},{"customer_snapshot.gstin":rx}];} const docs=await Sales.find(filter).sort({sales_date:-1,createdAt:-1}).limit(5000).lean();return NextResponse.json({sales:docs.map(safe),permissions:{canWrite:["admin","staff"].includes(a.user.role),canCancel:a.user.role==="admin"}}); } catch(e){console.error("List sales failed",e);return NextResponse.json({error:"Unable to load sales."},{status:500});} }
export async function POST(req) { let created=null,applied=[]; try { const a=await authorize(true);if(a.error)return NextResponse.json({error:a.error},{status:a.status});const body=await req.json(),doc=await build(body,a);doc.sales_number=await nextNumber(a.session.companyId,doc.sales_date,doc.gst_status);doc.companyid=a.session.companyId;doc.created_by=a.user._id;doc.updated_by=a.user._id; if (doc.amount_paid > 0) doc.payment_history=[{payment_date:doc.sales_date,payment_method:doc.payment_method,payment_amount:doc.amount_paid,balance_amount:doc.balance_amount,notes:doc.payment_note||"Initial payment recorded with sales",created_by:a.user._id}]; try{created=await Sales.create(doc);}catch(createError){try{await Sales.create({...doc,status:"Cancelled",cancelled_by:a.user._id,cancelled_at:new Date(),cancel_reason:"Bill number reserved but invoice creation failed: "+String(createError.message||"Unknown error")});}catch(auditError){console.error("Unable to save cancelled Sales number audit record",auditError);}throw createError;} try { applied=await applyDeltas(a.session.companyId,diffItems([],doc.items),doc.sales_number,doc.sales_date,"Sales bill recorded - stock reduced"); } catch(e){created.status="Cancelled";created.cancelled_by=a.user._id;created.cancelled_at=new Date();created.cancel_reason="Creation failed during stock validation: "+String(e.message||"Unknown error");await created.save();throw e;} return NextResponse.json({message:"Sales bill saved and stock reduced.",sales:safe(created)},{status:201}); } catch(e){console.error("Create sales failed",e);return NextResponse.json({error:e.message||"Unable to save sales."},{status:400});} }
export async function PUT(req) { let applied=[];let companyId=null;try {
 const a=await authorize(true);if(a.error)return NextResponse.json({error:a.error},{status:a.status});companyId=a.session.companyId;
 const body=await req.json();if(!mongoose.isValidObjectId(body.id))return NextResponse.json({error:"Invalid sales."},{status:400});
 const old=await Sales.findOne({_id:body.id,companyid:companyId});if(!old)return NextResponse.json({error:"Sales not found."},{status:404});if(old.status!=="Open")return NextResponse.json({error:"Only open sales can be edited."},{status:400});
 const doc=await build(body,a),oldStatus=old.gst_status||"GST",statusChanged=doc.gst_status!==oldStatus;
 if(statusChanged&&a.user.role!=="admin")return NextResponse.json({error:"Only an admin can change a saved bill's GST status."},{status:403});
 const history=old.payment_history||[];const paid=history.length?round(history.reduce((sum,x)=>sum+Number(x.payment_amount||0),0)):Number(old.amount_paid||0);
 if(doc.grand_total<paid)return NextResponse.json({error:"Grand Total cannot be less than payments already recorded."},{status:400});
 doc.amount_paid=paid;doc.balance_amount=round(doc.grand_total-paid);let runningPaid=0;doc.payment_history=history.map(entry=>{runningPaid=round(runningPaid+Number(entry.payment_amount||0));return {...(entry.toObject?entry.toObject():entry),balance_amount:Math.max(0,round(doc.grand_total-runningPaid))};});
 if(!history.length&&paid>0)doc.payment_history=[{payment_date:old.sales_date,payment_method:old.payment_method||"Cash",payment_amount:paid,balance_amount:old.balance_amount,notes:old.payment_note||"Previously recorded payment",created_by:a.user._id}];
 if(statusChanged){
  // A GST-status conversion cancels the original invoice and issues a new invoice number.
  const replacementNumber=await nextNumber(companyId,doc.sales_date,doc.gst_status);
  let replacement;try{replacement=await Sales.create({...doc,companyid:companyId,sales_number:replacementNumber,created_by:a.user._id,updated_by:a.user._id,replaced_sales_id:old._id});}catch(createError){try{await Sales.create({...doc,companyid:companyId,sales_number:replacementNumber,status:"Cancelled",cancelled_by:a.user._id,cancelled_at:new Date(),cancel_reason:"Replacement bill number reserved but invoice creation failed: "+String(createError.message||"Unknown error"),created_by:a.user._id,updated_by:a.user._id,replaced_sales_id:old._id});}catch(auditError){console.error("Unable to save cancelled replacement bill audit record",auditError);}throw createError;}
  try {
   await applyDeltas(companyId,diffItems(old.items,[]),old.sales_number,old.sales_date,"Original sales bill cancelled due to GST-status conversion - stock reversed");
   let replacementMovements=[];
   try {
    replacementMovements=await applyDeltas(companyId,diffItems([],doc.items),replacement.sales_number,doc.sales_date,"Replacement sales bill created after GST-status conversion - stock reduced");
    old.status="Cancelled";old.cancelled_by=a.user._id;old.cancelled_at=new Date();old.cancel_reason=`GST status changed from ${oldStatus} to ${doc.gst_status}`;old.replacement_sales_id=replacement._id;old.updated_by=a.user._id;await old.save();
   } catch(inner){
    for(const x of replacementMovements.reverse()){await ItemMaster.updateOne({_id:x.itemId,companyid:companyId},{$inc:{qty:-x.delta}});if(x.movementId)await StockMovement.deleteOne({_id:x.movementId,companyid:companyId});}
    await applyDeltas(companyId,diffItems([],old.items),old.sales_number,old.sales_date,"Stock restored after failed GST-status conversion");
    replacement.status="Cancelled";replacement.cancelled_by=a.user._id;replacement.cancelled_at=new Date();replacement.cancel_reason="Replacement creation failed during stock adjustment: "+String(inner.message||"Unknown error");await replacement.save();
    throw inner;
   }
   return NextResponse.json({message:`Original bill ${old.sales_number} cancelled. Replacement bill ${replacement.sales_number} created.`,sales:safe(replacement)});
  } catch(e){throw e;}
 }
 applied=await applyDeltas(companyId,diffItems(old.items,doc.items),old.sales_number,doc.sales_date,"Sales edited - stock quantity adjusted");Object.assign(old,doc,{updated_by:a.user._id});
 try{await old.save();}catch(e){for(const x of applied.reverse()){await ItemMaster.updateOne({_id:x.itemId,companyid:companyId},{$inc:{qty:-x.delta}});if(x.movementId)await StockMovement.deleteOne({_id:x.movementId,companyid:companyId});}throw e;}
 return NextResponse.json({message:"Sales bill updated and stock adjusted.",sales:safe(old)});
 }catch(e){console.error("Update sales failed",e);return NextResponse.json({error:e.message||"Unable to update sales."},{status:400});}}
export async function PATCH(req) { let applied=[]; let companyId=null; try {const a=await authorize(true);if(a.error)return NextResponse.json({error:a.error},{status:a.status});companyId=a.session.companyId;const body=await req.json();if(body.action==="cancel"&&a.user.role!=="admin")return NextResponse.json({error:"Only an admin can cancel sales bills."},{status:403});if(!mongoose.isValidObjectId(body.id))return NextResponse.json({error:"Invalid sales."},{status:400});const p=await Sales.findOne({_id:body.id,companyid:companyId});if(body.action==="add-payment"){if(!p)return NextResponse.json({error:"Sales not found."},{status:404});if(p.status!=="Open")return NextResponse.json({error:"Payments cannot be added to a cancelled sales."},{status:400});const paymentDate=body.payment_date?new Date(`${String(body.payment_date).slice(0,10)}T12:00:00+05:30`):new Date();const method=String(body.payment_method||"");const amount=Number(body.payment_amount);if(Number.isNaN(paymentDate.getTime()))return NextResponse.json({error:"Enter a valid payment date."},{status:400});if(!["Cash","Cheque","UPI","Online"].includes(method))return NextResponse.json({error:"Select a valid payment type."},{status:400});if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:"Payment amount must be greater than zero."},{status:400});const history=p.payment_history||[];let paid=round(history.reduce((sum,x)=>sum+Number(x.payment_amount||0),0));if(!history.length)paid=round(Number(p.amount_paid||0));const balance=round(Number(p.grand_total)-paid);if(balance<=0)return NextResponse.json({error:"This sales bill is already fully paid."},{status:400});if(amount>balance)return NextResponse.json({error:`Payment cannot exceed the outstanding balance of ${balance.toFixed(2)}.`},{status:400});const nextBalance=round(balance-amount);if(!history.length&&paid>0)history.push({payment_date:p.sales_date,payment_method:p.payment_method||"Cash",payment_amount:paid,balance_amount:balance,notes:p.payment_note||"Previously recorded payment",created_by:a.user._id});history.push({payment_date:paymentDate,payment_method:method,payment_amount:round(amount),balance_amount:nextBalance,notes:String(body.notes||"").trim().slice(0,1000),created_by:a.user._id});p.payment_history=history;p.amount_paid=round(paid+amount);p.balance_amount=nextBalance;p.payment_method=method;p.payment_note=String(body.notes||"").trim().slice(0,1000);p.updated_by=a.user._id;await p.save();return NextResponse.json({message:nextBalance===0?"Payment recorded. Sales bill is fully paid.":"Payment recorded successfully.",sales:safe(p)});}if(body.action!=="cancel")return NextResponse.json({error:"Invalid sales action."},{status:400});if(!p)return NextResponse.json({error:"Sales not found."},{status:404});if(p.status==="Cancelled")return NextResponse.json({error:"Sales bill is already cancelled."},{status:400});applied=await applyDeltas(companyId,diffItems(p.items,[]),p.sales_number,new Date(),"Sales bill cancelled - stock reversed");p.status="Cancelled";p.cancelled_by=a.user._id;p.cancelled_at=new Date();p.updated_by=a.user._id;await p.save();return NextResponse.json({message:"Sales bill cancelled and stock reversed."});}catch(e){for(const x of applied.reverse()){await ItemMaster.updateOne({_id:x.itemId,companyid:companyId},{$inc:{qty:-x.delta}});if(x.movementId) await StockMovement.deleteOne({_id:x.movementId,companyid:companyId});}console.error("Cancel sales failed",e);return NextResponse.json({error:e.message||"Unable to cancel sales."},{status:400});}}
