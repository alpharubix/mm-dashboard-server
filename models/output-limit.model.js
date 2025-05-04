import mongoose from 'mongoose'

const outputLimit = new mongoose.Schema(
  {
    sno: { type: Number, required: true },
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true, unique: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    lender: { type: String, required: true },
    sanctionLimit: { type: Number, required: true },
    operativeLimit: { type: Number, required: true },
    utilisedLimit: { type: Number, required: true },
    availableLimit: { type: Number, required: true },
    overdue: { type: Number, required: true },
    billingStatus: { type: String, required: true },
  },
  { timestamps: true }
)

export const OutputLimit = mongoose.model('OutputLimit', outputLimit)
