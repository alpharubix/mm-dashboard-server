import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { OnboardNotification } from '../models/onboard.model.js'
import { toCamelCase, uploadFileToFtp } from '../utils/index.js'

export async function onboardCsvParseAndSave(req, res) {
  const requiredFields = [
    'sno',
    'companyName',
    'distributorCode',
    'lender',
    'sanctionLimit',
    'limitLiveDate',
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
    const existingInDB = await OnboardNotification.find({
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
      const limitLiveDate = parse(r.limitLiveDate, 'dd-MM-yyyy', new Date())

      if (
        isNaN(sno) ||
        isNaN(sanctionLimit) ||
        isNaN(limitLiveDate.getTime())
      ) {
        throw new Error('Invalid data types in CSV')
      }
      return { ...r, sno, sanctionLimit, limitLiveDate }
    })

    // 6) FTP upload
    await uploadFileToFtp(filePath)

    // 7) Insert into Mongo
    insertedDocs = await OnboardNotification.insertMany(toInsert)

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
  if (user.role === 'superAdmin' || user.role == 'admin') {
    const page = Number(req.query.page || 1)
    const limit = Number(req.query.limit || 10)
    const companyName = String(req.query.companyName || '')
    const distributorCode = String(req.query.distributorCode || '')

    try {
      const filter = {}
      if (user.role === 'admin') {
        //anchor level view data control
        filter.anchor = user.companyId
      }
      if (companyName) filter.companyName = new RegExp(companyName, 'i')
      if (distributorCode)
        filter.distributorCode = new RegExp(distributorCode, 'i')
      const skip = (Number(page) - 1) * Number(limit)
      console.log('This is the filtered monogo obj', filter)
      const [data, total] = await Promise.all([
        OnboardNotification.find(filter).skip(skip).limit(Number(limit)),
        OnboardNotification.countDocuments(filter),
      ])
      res.status(200).json({
        data,
        skip,
        companyName,
        distributorCode,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        total,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    const companyId = user.companyId
    try {
      const data = await OnboardNotification.find(
        { distributorCode: companyId },
        { distributorCode: 1, sanctionLimit: 1, limitLiveDate: 1, anchor: 1 }
      )
      if (data.length === 0) {
        res.status(204).json({ message: 'No content' })
      }
      res.status(200).json(data)
    } catch (err) {
      res.status(500).json({ message: 'internel server issue' })
    }
  }
}
