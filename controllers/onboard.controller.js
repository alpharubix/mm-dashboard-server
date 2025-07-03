import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { Onboard } from '../models/onboard.model.js'
import { toCamelCase } from '../utils/index.js'

export async function onboardCsvParseAndSave(req, res) {
  const requiredFields = [
    'sno',
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
    if (existingInDB.length) {
      const existingCodes = existingInDB.map((doc) => doc.distributorCode)
      return res.status(400).json({
        message: 'Distributor Codes already exist in the database',
        duplicates: existingCodes,
      })
    }

    // 5) Cast & prepare documents
    const toInsert = rows.map((r) => {
      const sno = Number(r.sno)
      const sanctionLimit = Number(r.sanctionLimit.replace(/,/g, ''))
      const limitLiveDate = parse(r.limitLiveDate, 'dd-MM-yy', new Date())
      const limitExpiryDate = parse(r.limitExpiryDate, 'dd-MM-yy', new Date())

      if (
        isNaN(sno) ||
        isNaN(sanctionLimit) ||
        isNaN(limitLiveDate.getTime()) ||
        isNaN(limitExpiryDate.getDate())
      ) {
        throw new Error('Invalid data types in CSV')
      }
      return { ...r, sno, sanctionLimit, limitLiveDate, limitExpiryDate }
    })

    // 7) Insert into DB
    insertedDocs = await Onboard.insertMany(toInsert)

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

export const getOnboardData = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin' || user.role === 'admin') {
    const page = Number(req.query.page || 1)
    const limit = Number(req.query.limit || 10)
    const companyName = String(req.query.companyName || '')
    const distributorCode = String(req.query.distributorCode || '')
    const anchorId = String(req.query.anchorId || '')

    try {
      const filter = {}
      if (user.role === 'admin') {
        filter.anchorId = user.companyId
      }
      if (companyName) filter.companyName = new RegExp(companyName, 'i')
      if (anchorId) filter.anchorId = new RegExp(anchorId, 'i')
      if (distributorCode)
        filter.distributorCode = new RegExp(distributorCode, 'i')

      console.log('This is the filtered mongo obj', filter)

      // First get the total count
      const total = await Onboard.countDocuments(filter)
      const totalPages = Math.ceil(total / limit)

      // Then validate page number
      if (page > totalPages && total > 0) {
        return res.status(400).json({
          message: `Page ${page} does not exist. Total pages: ${totalPages}`,
          data: [],
          total,
          totalPages,
          page,
          skip: 0,
        })
      }

      const skip = (page - 1) * limit

      // Then get the data
      const data = await Onboard.find(filter, {
        createdAt: 0,
        updatedAt: 0,
        __v: 0,
        sno: 0,
      })
        .skip(skip)
        .limit(limit)

      res.status(200).json({
        message: 'Onboard data fetched successfully',
        data,
        skip,
        page,
        totalPages,
        total,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(403).json({ message: 'Forbidden: Insufficient role' })
  }
}
