import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { OutputUTR } from '../models/output-utr.model.js'
import { toCamelCase, uploadFileToFtp } from '../utils/index.js'

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

    // 4) Check if exists in DB
    const existing = await OutputUTR.find({
      invoiceNumber: { $in: invoiceNumbers },
    }).select('invoiceNumber')
    if (existing.length) {
      const existingNums = existing.map((doc) => doc.invoiceNumber)
      return res.status(400).json({
        message: 'InvoiceNumbers already exist in the database',
        duplicates: existingNums,
      })
    }

    // 5) Cast & insert
    const toInsert = rows.map((r) => {
      // Remove commas before converting to number
      const invoiceAmount = Number(r.invoiceAmount.replace(/,/g, ''))
      const loanAmount = Number(r.loanAmount.replace(/,/g, ''))

      // Parse dates
      const invoiceDate = parse(r.invoiceDate, 'dd-MM-yyyy', new Date())
      const loanDisbursementDate = parse(
        r.loanDisbursementDate,
        'dd-MM-yyyy',
        new Date()
      )

      // Validation
      if (
        isNaN(invoiceAmount) ||
        isNaN(loanAmount) ||
        isNaN(invoiceDate.getTime()) ||
        isNaN(loanDisbursementDate.getTime())
      ) {
        throw new Error('Invalid number or date in CSV')
      }

      return {
        ...r,
        invoiceAmount,
        loanAmount,
        invoiceDate,
        loanDisbursementDate,
        utr: r.utr,
        status: r.status,
      }
    })

    // 6) FTP upload
    await uploadFileToFtp(filePath)

    // 6) Insert into Mongo
    insertedDocs = await OutputUTR.insertMany(toInsert)
    res.json({
      message: 'File parsed and saved successfully',
      insertedCount: insertedDocs.length,
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

export const getOutputUtrData = async (req, res) => {
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

    if (companyName) {
      filter.companyName = new RegExp(companyName, 'i')
    }
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
      filter.status = new RegExp(status, 'i')
    }

    if (fromDate || toDate) {
      const dateFilter = {}

      if (fromDate) {
        const from = parse(fromDate, 'dd-MM-yyyy', new Date())
        dateFilter.$gte = from
      }

      if (toDate) {
        const to = parse(toDate, 'dd-MM-yyyy', new Date())
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
}
