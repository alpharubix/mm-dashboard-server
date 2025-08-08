import csvParser from 'csv-parser'
import { parse, isValid } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { Onboard } from '../../models/onboard.model.js'
import { toCamelCase } from '../../utils/index.js'

export async function onboardCsvParseAndSave(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'lender',
    'sanctionLimit',
    'limitLiveDate',
    'limitExpiryDate',
    'anchorId',
    'fundingType',
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

    // 3) Check for duplicate distributorCodes within CSV
    const distributorCodesInCSV = rows.map((r) => r.distributorCode)
    const duplicateCodesInCSV = distributorCodesInCSV.filter(
      (item, index) => distributorCodesInCSV.indexOf(item) !== index
    )
    if (duplicateCodesInCSV.length) {
      return res.status(400).json({
        message: 'Duplicate Distributor Codes found in CSV',
        duplicates: [...new Set(duplicateCodesInCSV)],
      })
    }
    // 4) Check for existing distributorCodes in MongoDB
    const existingInDB = await Onboard.find({
      distributorCode: { $in: distributorCodesInCSV },
    }).select('distributorCode')

    // Create a Set for fast lookup of existing codes
    const existingCodesSet = new Set(
      existingInDB.map((doc) => doc.distributorCode)
    )

    // 5) Cast & prepare documents
    const bulkOps = rows.map((r) => {
      const sanctionLimit = Number(r.sanctionLimit.replace(/,/g, ''))
      const limitLiveDate = parse(r.limitLiveDate, 'dd-MM-yy', new Date())
      const limitExpiryDate = parse(r.limitExpiryDate, 'dd-MM-yy', new Date())
      const status = r.status

      if (!isValid(limitLiveDate)) {
        throw new Error(`Invalid date format: ${r.limitLiveDate}`)
      }

      if (!isValid(limitExpiryDate)) {
        throw new Error(`Invalid date format: ${r.limitExpiryDate}`)
      }

      if (
        isNaN(sanctionLimit) ||
        typeof status !== 'string' ||
        status.trim() === ''
      ) {
        throw new Error('Invalid input: Please check sanctionLimit, status')
      }

      const document = {
        ...r,
        sanctionLimit,
        limitLiveDate,
        limitExpiryDate,
        status,
      }

      if (existingCodesSet.has(r.distributorCode)) {
        return {
          updateOne: {
            filter: { distributorCode: r.distributorCode },
            update: { $set: document },
          },
        }
      } else {
        return {
          insertOne: {
            document,
          },
        }
      }
    })
    // 7) Insert into DB
    // Execute bulk write
    insertedDocs = await Onboard.bulkWrite(bulkOps)
    // 8) Success Response
    res.json({
      message: 'File parsed and saved successfully',
      insertedCount: insertedDocs.length,
    })
  } catch (error) {
    console.error('Error processing CSV and saving data:', error)
    res
      .status(500)
      .json({ message: 'Failed to process CSV', error: error.message })
  } finally {
    // 9) Always delete temp file, even on error
    try {
      await unlink(filePath)
      console.log(`Temporary file ${filePath} deleted.`)
    } catch (unlinkErr) {
      console.warn('Failed to delete temp file:', unlinkErr)
    }
  }
}
