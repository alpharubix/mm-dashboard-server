import { parse } from 'date-fns'

import { OutputUTR } from '../../models/output-utr.model.js'

export const getOutputUtrData = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin' || user.role === 'admin') {
    try {
      const {
        companyName,
        invoiceNumber,
        distributorCode,
        utr,
        fromDate,
        toDate,
        status,
        page = 1,
        limit = 10,
      } = req.query

      const filter = {}

      if (user.role === 'admin') {
        filter.anchor = user.companyId
      }

      if (companyName) {
        filter.companyName = new RegExp(companyName, 'i')
      }
      if (invoiceNumber) {
        // Convert number field to string and do partial matching
        filter.$expr = {
          $regexMatch: {
            input: { $toString: '$invoiceNumber' },
            regex: invoiceNumber,
            options: 'i',
          },
        }
      }
      if (distributorCode) {
        filter.distributorCode = new RegExp(distributorCode, 'i')
      }
      if (utr) {
        filter.utr = new RegExp(utr, 'i')
      }
      if (status) {
        filter.status = new RegExp(status, 'i')
      }

      if (fromDate || toDate) {
        const dateFilter = {}

        if (fromDate) {
          const from = parse(fromDate, 'dd-MM-yy', new Date())
          dateFilter.$gte = from
        }

        if (toDate) {
          const to = parse(toDate, 'dd-MM-yy', new Date())
          to.setHours(23, 59, 59, 999)
          dateFilter.$lte = to
        }

        filter.invoiceDate = dateFilter
      }

      const skip = (Number(page) - 1) * Number(limit)

      const data = await OutputUTR.find(filter)
        .skip(skip)
        .limit(Number(limit))
        .sort({ invoiceDate: -1 })

      const total = await OutputUTR.countDocuments(filter)

      res.status(200).json({
        message: 'Fetched output UTR data successfully',
        data,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      })
    } catch (error) {
      console.error('Error fetching OutputUTR data:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  } else {
    try {
      const data = await OutputUTR.find(
        { distributorCode: user.companyId },
        {
          distributorCode: 1,
          invoiceNumber: 1,
          invoiceAmount: 1,
          invoiceDate: 1,
          loanAmount: 1,
          loanDisbursementDate: 1,
          utr: 1,
          status: 1,
        }
      )
      if (data.length === 0) {
        res.status(204)
      }
      res.status(200).json({ message: data })
    } catch (err) {
      console.log('Error getting the data from the database')
      res.status(500).json({ message: 'Internal server error' })
    }
  }
}
