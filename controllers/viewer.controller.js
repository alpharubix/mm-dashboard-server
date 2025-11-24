import { CreditLimit } from '../models/credit-limit.model.js'
import { Invoice } from '../models/invoice.model.js'
import { Onboard } from '../models/onboard.model.js'

export const getViewerData = async (req, res) => {
  const user = req.user

  if (user.role !== 'viewer') {
    return res.status(401).json({ message: 'forbidden access' })
  }

  if (!user.username) {
    return res.status(400).json({ message: 'Phone number required' })
  }

  try {
    const phoneQuery = { distributorPhone: user.username }

    const [onboardData, credLimit, invoiceData] = await Promise.all([
      Onboard.find(phoneQuery, {
        distributorCode: 1,
        sanctionLimit: 1,
        limitLiveDate: 1,
        anchorId: 1,
        distributorPhone: 1,
        _id: 0,
      }),

      CreditLimit.find(phoneQuery, {
        distributorCode: 1,
        utilisedLimit: 1,
        overdue: 1,
        anchorId: 1,
        distributorPhone: 1,
        _id: 0,
      }),

      Invoice.find(phoneQuery, {
        distributorCode: 1,
        loanAmount: 1,
        loanDisbursementDate: 1,
        anchorId: 1,
        utr: 1,
        invoiceAmount: 1,
        invoiceNumber: 1,
        invoiceDate: 1,
        status: 1,
        distributorPhone: 1,
        invoicePdfUrl: 1,
        _id: 0,
      }).sort({ invoiceDate: -1 }),
    ])

    res.status(200).json({
      data: { onboardData, credLimit, invoiceData },
    })
  } catch (error) {
    console.log('Database query error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
