import mongoose from 'mongoose'

const inputSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    distributorCode: { type: String, required: true },
    beneficiaryName: { type: String, required: true },
    beneficiaryAccNo: { type: String, required: true },
    bankName: { type: String, required: true },
    ifscCode: { type: String, required: true },
    branch: { type: String, required: true },
    invoiceNum: { type: String, required: true },
    invoiceAmount: { type: Number, required: true },
    invoiceDate: { type: Date, required: true },
    loanAmountExclCreditBalance: { type: Number, required: true },
    invoicePdfUrl: { type: String, required: true },
  },
  { timestamps: true }
)

export const Input = mongoose.model('Input', inputSchema)
