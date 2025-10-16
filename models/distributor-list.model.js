import mongoose from 'mongoose'

const allowedDistributor = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true },
    distributorPhone: { type: String, required: true },
    distributorEmail: { type: String, required: true },
    lender: { type: String, required: true },
    lenderEmail: { type: String, required: true },
    anchorId: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

export const Distributor = mongoose.model('Distributor', allowedDistributor)
