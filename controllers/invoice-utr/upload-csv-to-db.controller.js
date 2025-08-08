import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { Invoice } from '../../models/invoice.model.js'
import { toCamelCase } from '../../utils/index.js'
import { CreditLimit } from '../../models/credit-limit.model.js'
import { calculatePendingInvoices } from '../../utils/services.js'

export async function invoiceCsvParseAndSave(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'beneficiaryName',
    'beneficiaryAccNo',
    'bankName',
    'ifscCode',
    'branch',
    'invoiceNumber',
    'invoiceAmount',
    'invoiceDate',
    'loanAmount',
    'loanDisbursementDate',
    'utr',
    'status',
    'anchorId',
  ]

  if (!req.file?.path) {
    return res.status(400).json({ message: 'No file uploaded' })
  }
  const filePath = req.file.path
  const rows = []

  try {
    // 1) Parse CSV into rows[]
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => toCamelCase(header),
          })
        )
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject)
    })

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV is empty' })
    }

    // 2) Header validation
    const csvFields = Object.keys(rows[0])
    const missing = requiredFields.filter((f) => !csvFields.includes(f))
    const extra = csvFields.filter((f) => !requiredFields.includes(f))
    if (missing.length || extra.length) {
      return res.status(400).json({
        message: 'CSV header mismatch',
        missingFields: missing,
        extraFields: extra,
      })
    }

    // 3) Check for duplicate invoiceNumbers
    const invoiceNumbers = rows.map((r) => r.invoiceNumber)
    const duplicatesInCSV = invoiceNumbers.filter(
      (item, index) => invoiceNumbers.indexOf(item) !== index
    )
    if (duplicatesInCSV.length) {
      return res.status(400).json({
        message: 'Duplicate invoiceNumbers in CSV',
        duplicates: [...new Set(duplicatesInCSV)],
      })
    }

    // 5) Cast & update
    const updateOps = []

    for (const r of rows) {
      const invoiceAmount = Number(r.invoiceAmount.replace(/,/g, ''))
      const loanAmount = Number(r.loanAmount.replace(/,/g, ''))
      const invoiceDate = parse(r.invoiceDate, 'dd-MM-yy', new Date())

      if (
        isNaN(invoiceAmount) ||
        isNaN(loanAmount) ||
        isNaN(invoiceDate.getTime())
      ) {
        throw new Error(`Invalid data in invoice ${r.invoiceNumber}`)
      }

      let loanDisbursementDate = null
      if (r.loanDisbursementDate && r.loanDisbursementDate !== 'NA') {
        const parsed = parse(r.loanDisbursementDate, 'dd-MM-yy', new Date())
        if (!isNaN(parsed.getTime())) {
          loanDisbursementDate = parsed
        }
      }

      const updateFields = {}
      if (r.utr && r.utr !== 'NA') updateFields.utr = r.utr
      if (r.status && r.status !== 'NA') updateFields.status = r.status
      if (loanDisbursementDate)
        updateFields.loanDisbursementDate = loanDisbursementDate

      updateOps.push({
        updateOne: {
          filter: { invoiceNumber: r.invoiceNumber },
          update: { $set: updateFields },
        },
      })

      if (r.distributorCode) {
        try {
          const pendingInvoices = await calculatePendingInvoices(
            r.distributorCode
          )
          const creditLimit = await CreditLimit.findOne({
            distributorCode: r.distributorCode,
          })

          if (creditLimit) {
            const currentAvailable =
              creditLimit.availableLimit - pendingInvoices

            await CreditLimit.updateOne(
              { distributorCode: r.distributorCode },
              { $set: { pendingInvoices, currentAvailable } }
            )
          }
        } catch (updateError) {
          console.error(
            'Failed to update pending invoices:',
            updateError.message
          )
          // Don't fail the whole operation, just log the error
        }
      }
    }

    let result = { matchedCount: 0, modifiedCount: 0 }
    if (updateOps.length) {
      result = await Invoice.bulkWrite(updateOps, { ordered: false })
    }

    // 6) Final response
    res.json({
      message: 'File parsed and updated successfully',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    })
  } catch (err) {
    console.error('Error processing CSV and saving data:', err)
    res
      .status(500)
      .json({ message: 'Failed to process CSV', error: err.message })
  } finally {
    try {
      await unlink(filePath)
      console.log(`Temporary file ${filePath} deleted.`)
    } catch (unlinkErr) {
      console.warn('Failed to delete temp file:', unlinkErr)
    }
  }
}
