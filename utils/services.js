import { Invoice } from '../models/invoice.model.js'

const NULL_VALUES = [
  null,
  '',
  'NA',
  'N/A',
  'NULL',
  'null',
  '-',
  'nil',
  'none',
  0,
  '0',
  '.',
  '_',
]

export const calculatePendingInvoices = async (distributorCode) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        distributorCode,
        status: { $ne: 'notProcessed' },
        utr: { $in: NULL_VALUES },
      },
    },
    {
      $group: {
        _id: null,
        totalPendingInvoices: { $sum: '$loanAmount' }, // Using loanAmount instead of invoiceAmount cause some customers might have some discounts or some free cash offer from anchor, but we dont consider that in the calculation and take the loanAmount.
      },
    },
  ])
  return result[0]?.totalPendingInvoices || 0
}
