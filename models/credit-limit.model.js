import mongoose from 'mongoose'

const creditLimit = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true, unique: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    lender: { type: String, required: true },
    limitExpiryDate: { type: Date, required: true },
    sanctionLimit: { type: Number, required: true },
    operativeLimit: { type: Number, required: true },
    utilisedLimit: { type: Number, required: true },
    availableLimit: { type: Number, required: true },
    distributorPhone: { type: String, required: true },
    distributorEmail: { type: String, required: true },
    pendingInvoices: { type: Number, required: true }, //Sum of customer's invoice where UTR is blank and Status excluding "Not Processed"
    currentAvailable: { type: Number, required: true }, //(Available Limit - Pending Invoices)
    overdue: { type: Number, required: true },
    billingStatus: {
      type: String,
      required: true,
      enum: ['positive', 'negative'],
    },
    anchorId: { type: String, required: true },
    fundingType: { type: String, required: true, enum: ['open', 'close'] },
  },
  { timestamps: true }
)

export const CreditLimit = mongoose.model('CreditLimit', creditLimit)
