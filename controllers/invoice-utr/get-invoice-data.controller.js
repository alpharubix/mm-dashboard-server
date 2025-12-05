import { parse } from 'date-fns'

import { Invoice } from '../../models/invoice.model.js'

export const getInvoiceData = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin' || user.role === 'admin') {
    try {
      const {
        companyName,
        invoiceNumber,
        distributorCode,
        utr,
        fromInvoiceDate,
        toDate,
        fromLoanDisbursementDate,
        toLoanDisbursementDate,
        status,
        anchorId,
        page = 1,
        limit = 10,
        export: isExport,
      } = req.query

      const filter = {}

      if (user.role === 'admin') {
        filter.anchorId = user.companyId
      }

      if (companyName) {
        filter.companyName = new RegExp(companyName, 'i')
      }

      if (anchorId) filter.anchorId = new RegExp(anchorId, 'i')

      if (invoiceNumber) {
        filter.invoiceNumber = new RegExp(invoiceNumber, 'i')
      }

      if (distributorCode) {
        filter.distributorCode = new RegExp(distributorCode, 'i')
      }

      if (utr) {
        filter.utr = new RegExp(utr, 'i')
      }

      if (status) {
        filter.status = new RegExp(`^${status}$`, 'i')
      }

      if (fromInvoiceDate || toDate) {
        const dateFilter = {}

        if (fromInvoiceDate) {
          const from = parse(fromInvoiceDate, 'dd-MM-yy', new Date())
          dateFilter.$gte = from
        }

        if (toDate) {
          const to = parse(toDate, 'dd-MM-yy', new Date())
          to.setHours(23, 59, 59, 999)
          dateFilter.$lte = to
        }

        filter.invoiceDate = dateFilter
      }

      if (fromLoanDisbursementDate || toLoanDisbursementDate) {
        const dateFilter = {}

        if (fromLoanDisbursementDate) {
          const from = parse(fromLoanDisbursementDate, 'dd-MM-yy', new Date())
          dateFilter.$gte = from
        }

        if (toLoanDisbursementDate) {
          const to = parse(toLoanDisbursementDate, 'dd-MM-yy', new Date())
          to.setHours(23, 59, 59, 999)
          dateFilter.$lte = to
        }

        filter.loanDisbursementDate = dateFilter
      }

      // console.log({ filter })

      // First get the total count
      const total = await Invoice.countDocuments(filter)

      if (isExport === 'true') {
        const exportLimit = 500

        if (total > exportLimit) {
          return res.status(400).json({
            message: `Export limit exceeded. Maximum ${exportLimit} records allowed. Current result: ${total} records. Please refine your filters.`,
            total,
            limit: exportLimit,
          })
        }

        const data = await Invoice.find(filter)
          .sort({ invoiceDate: -1 })
          .limit(exportLimit) // Safety limit

        return res.status(200).json({
          message: 'Invoice data fetched successfully',
          data,
          total,
          isExport: true,
        })
      }

      const totalPages = Math.ceil(total / Number(limit))

      // Then validate page number
      if (Number(page) > totalPages && total > 0) {
        return res.status(400).json({
          message: `Page ${page} does not exist. Total pages: ${totalPages}`,
          data: [],
          page: Number(page),
          totalPages,
          total,
          skip: 0,
        })
      }

      const skip = (Number(page) - 1) * Number(limit)

      const projection = {
        __v: 0,
      }

      if (user.role === 'admin') {
        Object.assign(projection, {
          beneficiaryName: 0,
          beneficiaryAccNo: 0,
          bankName: 0,
          ifscCode: 0,
          branch: 0,
        })
      }

      const data = await Invoice.find(filter, projection)
        .skip(skip)
        .limit(Number(limit))
        .sort({ invoiceDate: -1 })

      // TODO: Fix skip
      res.status(200).json({
        message: 'Invoice data fetched successfully',
        data,
        total,
        page: Number(page),
        totalPages,
        skip,
      })
    } catch (error) {
      console.error('Error fetching Invoice data:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  } else {
    res.status(403).json({ message: 'Forbidden: Insufficient role' })
  }
}
