import mongoose from 'mongoose'

const outputUTR = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true },
    beneficiaryName: { type: String, required: true },
    beneficiaryAccNo: { type: String, required: true },
    bankName: { type: String, required: true },
    ifscCode: { type: String, required: true },
    branch: { type: String, required: true },
    invoiceNumber: { type: Number, required: true, unique: true },
    invoiceAmount: { type: Number, required: true },
    invoiceDate: { type: Date, required: true },
    loanAmount: { type: Number, required: true },
    loanDisbursementDate: { type: Date, default: null },
    utr: { type: String, default: 'N/A' },
    anchor: { type: String, required: true, enum: ['CKPL', 'HWC', 'OTHERS'] },
    anchorType: { type: String, required: true, enum: ['open', 'close'] },
    status: {
      type: String,
      enum: ['completed', 'pending'],
      default: 'pending',
      required: true,
    },
    invoicePdfUrl: { type: String },
  },
  { timestamps: true }
)

export const OutputUTR = mongoose.model('OutputUTR', outputUTR)
