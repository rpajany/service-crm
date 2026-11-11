import mongoose from "mongoose";
const schema=new mongoose.Schema({companyid:{type:mongoose.Schema.Types.ObjectId,ref:"Company",required:true},financial_year:{type:String,required:true},gst_status:{type:String,enum:["GST","Non-GST"],required:true,default:"GST"},prefix:{type:String,default:"SAL"},last_number:{type:Number,default:0,min:0},starting_number:{type:Number,default:1,min:0},numbering_policy:{type:String,enum:["continuous","reset","custom"],default:"continuous"}},{timestamps:true});
schema.index({companyid:1,financial_year:1,gst_status:1},{unique:true});
export default mongoose.models.SalesSequence||mongoose.model("SalesSequence",schema);
