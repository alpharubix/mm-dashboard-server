import { INV_STATUS } from '../conf/index.js'
import { Invoice } from '../models/invoice.model.js'

const BLANK_UTR_VALUES = [
  null,
  '',
  'NA',
  'N/A',
  'NULL',
  'null',
  '-',
  'nil',
  'none',
  '.',
  '_',
]

export const calculatePendingInvoices = async (distributorCode) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        distributorCode,
        status: { $nin: [INV_STATUS.NOT_PROCESSED, INV_STATUS.PROCESSED] },
        $or: [{ utr: { $in: BLANK_UTR_VALUES } }, { utr: { $exists: false } }],
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
