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
    loanDisbursementDate: { type: Date, default: null },
    utr: { type: String, default: 'NA' },
    anchorId: { type: String, required: true },
    fundingType: { type: String, required: true, enum: ['open', 'close'] },
    status: {
      type: String,
      enum: [
        'yetToProcess', // Invice received from anchor
        'inProgress', // Invioce received from anchor sent for processing
        'processed', // UTR received against payment request shared.
        'pendingWithCustomer', // Invoice payment can be pending from customer
        'pendingWithLender', // Invoice is not processed from lenders
        'notProcessed', // Invoice received can be cancelled
      ],
      default: 'yetToProcess',
      required: true,
    },
    invoicePdfUrl: { type: String },
  },
  { timestamps: true }
)

export const OutputUTR = mongoose.model('OutputUTR', outputUTR)
