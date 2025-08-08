import { Invoice } from '../models/invoice.model.js'

export const calculatePendingInvoices = async (distributorCode) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        distributorCode,
        status: { $ne: 'notProcessed' },
        utr: null,
      },
    },
    {
      $group: {
        _id: null,
        totalPendingInvoices: { $sum: '$loanAmount' },
      },
    },
  ])
  return result[0]?.totalPendingInvoices || 0
}
