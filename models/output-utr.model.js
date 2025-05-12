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
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceAmount: { type: Number, required: true },
    invoiceDate: { type: Date, required: true },
    loanAmount: { type: Number, required: true },
    loanDisbursementDate: { type: Date, required: true },
    utr: { type: String, required: true },
    status: { type: String, required: true },
  },
  { timestamps: true }
)

export const OutputUTR = mongoose.model('OutputUTR', outputUTR)
