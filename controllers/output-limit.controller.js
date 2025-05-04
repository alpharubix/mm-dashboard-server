import csvParser from 'csv-parser'
import fs from 'fs'
import { OutputLimit } from '../models/output-limit.model.js'
import { toCamelCase } from '../utils/index.js'

export async function outputLimitCsvParseAndSave(req, res) {
  const requiredFields = [
    'sno',
    'companyName',
    'distributorCode',
    'city',
    'state',
    'lender',
    'sanctionLimit',
    'operativeLimit',
    'utilisedLimit',
    'availableLimit',
    'overdue',
    'billingStatus',
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

    // 3) Check for duplicate distributorCodes
    const distributorCodes = rows.map((r) => r.distributorCode)
    const duplicatesInCSV = distributorCodes.filter(
      (item, index) => distributorCodes.indexOf(item) !== index
    )
    if (duplicatesInCSV.length) {
      return res.status(400).json({
        message: 'Duplicate Distributor Codes in CSV',
        duplicates: duplicatesInCSV,
      })
    }

    // 4) Cast & prepare documents
    const toInsert = rows.map((r) => ({
      ...r,
      sno: Number(r.sno),
      sanctionLimit: Number(r.sanctionLimit),
      operativeLimit: Number(r.operativeLimit),
      utilisedLimit: Number(r.utilisedLimit),
      availableLimit: Number(r.availableLimit),
      overdue: Number(r.overdue),
      billingStatus: r.billingStatus,
    }))

    // 5) Clear previous data
    await OutputLimit.deleteMany({})

    // 6) Insert into Mongo
    const docs = await OutputLimit.insertMany(toInsert)

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
