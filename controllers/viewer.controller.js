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

  // Pagination parameters
  const page = Math.max(1, Number(req.query.page || 1))
  const limit = Math.max(1, Number(req.query.limit || 10))
  const skip = (page - 1) * limit

  try {
    const phoneQuery = { distributorPhone: user.username }

    // Fetch total count for pagination metadata
    const totalInvoices = await Invoice.countDocuments(phoneQuery)
    const totalPages = Math.ceil(totalInvoices / limit)

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
        limitExpiryDate: 1,
        pendingInvoices: 1,
        operativeLimit: 1,
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
      })
        .sort({ invoiceDate: -1, _id: 1 })
        .skip(skip)
        .limit(limit),
    ])

    res.status(200).json({
      data: {
        onboardData,
        credLimit,
        invoiceData,
      },
      pagination: {
        total: totalInvoices,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Database query error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
