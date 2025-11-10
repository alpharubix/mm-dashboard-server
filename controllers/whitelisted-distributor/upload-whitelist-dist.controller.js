import { Distributor } from '../../models/distributor-list.model.js'
import csvParser from 'csv-parser'
import fs from 'fs'
import { unlink } from 'fs/promises'
import { isValidPhone, toCamelCase } from '../../utils/index.js'

export async function parseAndSaveDistributors(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'distributorPhone',
    'distributorEmail',
    'lender',
    'anchorId',
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
    console.log('After-conversion=>', rows)
    // 2) Header validation
    // Remove completely empty rows first
    const validRows = rows.filter((r) =>
      Object.values(r).some((v) => v?.trim?.() !== '')
    )
    if (!validRows.length) {
      return res.status(400).json({ message: 'CSV has no valid rows' })
    }

    // Use first valid row for header validation
    const csvFields = Object.keys(validRows[0])
    const missing = requiredFields.filter((f) => !csvFields.includes(f))
    if (missing.length) {
      return res.status(400).json({
        message: 'CSV header mismatch',
        missingFields: missing,
      })
    }

    // 3) Check for duplicate distributorCodes within CSV
    const distributorCodesInCSV = validRows
      .map((r) => r.distributorCode?.trim())
      .filter((code) => code)

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
    const existingInDB = await Distributor.find({
      distributorCode: { $in: distributorCodesInCSV },
    }).select('distributorCode')

    // Create a Set for fast lookup of existing codes
    const existingCodesSet = new Set(
      existingInDB.map((doc) => doc.distributorCode)
    )

    // 5) Cast & prepare documents
    const bulkOps = validRows.map((r) => {
      const companyName = r.companyName.trim()
      const distributorCode = String(r.distributorCode)
      const lender = r.lender.trim()
      const anchorId = r.anchorId.trim()
      if (!isValidPhone(r.distributorPhone.trim())) {
        throw new Error(`Invalid phone number format: ${r.distributorPhone}`)
      }
      const distributorPhone = r.distributorPhone.trim()
      const distributorEmail = r.distributorEmail.trim()

      const document = {
        companyName,
        distributorCode,
        lender,
        anchorId,
        distributorPhone,
        distributorEmail,
      }

      // 6) Check for existing distributorCode and update if found, else insert
      if (existingCodesSet.has(distributorCode)) {
        return {
          updateOne: {
            filter: { distributorCode: distributorCode },
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
    insertedDocs = await Distributor.bulkWrite(bulkOps)
    console.log('Inserted-message', insertedDocs)
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
