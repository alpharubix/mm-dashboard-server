import mongoose from 'mongoose'

const onboardSchema = new mongoose.Schema(
  {
    sno: { type: Number, required: true },
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true, unique: true },
    lender: { type: String, required: true },
    sanctionLimit: { type: Number, required: true },
    limitLiveDate: { type: Date, required: true },
    anchor:{type:String,required:true,enum: ['CKPL', 'HWC']},
  },
  {versionKey:false},
  { timestamps: true },
)

export const OnboardNotification = mongoose.model(
  'OnboardNotification',
  onboardSchema
)
