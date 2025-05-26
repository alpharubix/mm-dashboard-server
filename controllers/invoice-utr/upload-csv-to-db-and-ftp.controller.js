import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { OutputUTR } from '../../models/output-utr.model.js'
import { toCamelCase } from '../../utils/index.js'

export async function outputUtrCsvParseAndSave(req, res) {
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
  ]

  if (!req.file?.path) {
    return res.status(400).json({ message: 'No file uploaded' })
  }
  const filePath = req.file.path
  const rows = []
  let insertedDocs // To store the inserted documents if successful

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

    // 5) Cast & insert
    // const toInsert = rows.map((r) => {
    //   // Remove commas before converting to number
    //   const invoiceAmount = Number(r.invoiceAmount.replace(/,/g, ''))
    //   const loanAmount = Number(r.loanAmount.replace(/,/g, ''))

    //   // Parse dates
    //   const invoiceDate = parse(r.invoiceDate, 'dd-MM-yyyy', new Date())
    //   const loanDisbursementDate = parse(
    //     r.loanDisbursementDate,
    //     'dd-MM-yyyy',
    //     new Date()
    //   )

    //   // Validation
    //   if (
    //     isNaN(invoiceAmount) ||
    //     isNaN(loanAmount) ||
    //     isNaN(invoiceDate.getTime()) ||
    //     isNaN(loanDisbursementDate.getTime())
    //   ) {
    //     throw new Error('Invalid number or date in CSV')
    //   }

    //   return {
    //     ...r,
    //     invoiceAmount,
    //     loanAmount,
    //     invoiceDate,
    //     loanDisbursementDate,
    //     utr: r.utr,
    //     status: r.status,
    //   }
    // })

    // 6) FTP upload
    // await uploadFileToFtp(filePath)

    // 5) Cast & update
    const updateOps = []

    for (const r of rows) {
      const invoiceAmount = Number(r.invoiceAmount.replace(/,/g, ''))
      const loanAmount = Number(r.loanAmount.replace(/,/g, ''))
      const invoiceDate = parse(r.invoiceDate, 'dd-MM-yyyy', new Date())
      const loanDisbursementDate = parse(
        r.loanDisbursementDate,
        'dd-MM-yyyy',
        new Date()
      )

      if (
        isNaN(invoiceAmount) ||
        isNaN(loanAmount) ||
        isNaN(invoiceDate.getTime()) ||
        isNaN(loanDisbursementDate.getTime())
      ) {
        throw new Error(
          `Invalid number or date in CSV for invoice ${r.invoiceNumber}`
        )
      }

      updateOps.push({
        updateOne: {
          filter: { invoiceNumber: r.invoiceNumber },
          update: {
            $set: {
              utr: r.utr,
              status: r.status,
              loanDisbursementDate,
            },
          },
        },
      })
    }

    let result = { matchedCount: 0, modifiedCount: 0 }
    if (updateOps.length) {
      result = await OutputUTR.bulkWrite(updateOps, { ordered: false })
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
