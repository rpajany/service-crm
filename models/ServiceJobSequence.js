import mongoose from "mongoose";
const schema=new mongoose.Schema({companyid:{type:mongoose.Schema.Types.ObjectId,required:true},year:{type:String,required:true},last_number:{type:Number,default:0}},{timestamps:true});schema.index({companyid:1,year:1},{unique:true});export default mongoose.models.ServiceJobSequence||mongoose.model("ServiceJobSequence",schema);
