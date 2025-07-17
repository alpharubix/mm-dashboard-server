import mongoose from 'mongoose'

const onboardSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true, unique: true },
    lender: { type: String, required: true },
    sanctionLimit: { type: Number, required: true },
    limitLiveDate: { type: Date, required: true },
    limitExpiryDate: { type: Date, required: true },
    anchorId: { type: String, required: true },
    fundingType: { type: String, required: true, enum: ['open', 'close'] },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
)

export const Onboard = mongoose.model('Onboard', onboardSchema)
