import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { OutputUTR } from '../models/output-utr.model.js'
import { toCamelCase } from '../utils/index.js'

export async function outputUtrCsvParseAndSave(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'beneficiaryName',
    'beneficiaryAccountNo',
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
        duplicates: duplicatesInCSV,
      })
    }

    // 4) Check if exists in DB
    const existing = await OutputUTR.find({
      invoiceNumber: { $in: invoiceNumbers },
    }).select('invoiceNumber')
    if (existing.length) {
      const existingNums = existing.map((doc) => doc.invoiceNumber)
      return res.status(400).json({
        message: 'InvoiceNumbers already exist in DB',
        duplicates: existingNums,
      })
    }

    // 5) Cast & insert
    const toInsert = rows.map((r) => ({
      ...r,
      invoiceAmount: Number(r.invoiceAmount),
      loanAmount: Number(r.loanAmount),
      // invoiceDate: new Date(r.invoiceDate),
      // loanDisbursementDate: new Date(r.loanDisbursementDate),
      invoiceDate: parse(r.invoiceDate, 'dd-MM-yyyy', new Date()),
      loanDisbursementDate: parse(
        r.loanDisbursementDate,
        'dd-MM-yyyy',
        new Date()
      ),
      utr: r.utr,
      status: r.status,
    }))

    // 6) Insert into Mongo
    const docs = await OutputUTR.insertMany(toInsert)
    res.json({
      message: 'File parsed and saved successfully',
      insertedCount: docs.length,
    })
  } catch (err) {
    console.error('CSV processing error:', err)
    res
      .status(500)
      .json({ message: 'Internal server error', error: err.message })
  }
}
