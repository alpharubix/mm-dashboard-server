import ftp from 'basic-ftp'
import csvParser from 'csv-parser'
import fs from 'fs'
import { unlink } from 'fs/promises'
import path from 'path'

import { ENV } from '../conf/index.js'
import { OnboardNotification } from '../models/onboard.model.js'
import { toCamelCase } from '../utils/index.js'

async function uploadFileToFtp(filePath) {
  const client = new ftp()
  try {
    await client.connect({
      host: ENV.FTP_HOST,
      user: ENV.FTP_USER,
      password: ENV.FTP_PASS,
      secure: false,
    })
    await client.uploadFrom(filePath, path.basename(filePath))
  } finally {
    try {
      await client.close()
    } catch (closeErr) {
      console.warn('Error closing FTP connection:', closeErr)
    }
  }
}

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

    const existing = await OnboardNotification.find({
      distributorCode: { $in: distributorCodes },
    }).select('distributorCode')
    if (existing.length) {
      const existingNums = existing.map((doc) => doc.distributorCode)
      return res.status(400).json({
        message: 'distributorCodes already exist in DB',
        duplicates: existingNums,
      })
    }

    // 4) Cast & prepare documents
    const toInsert = rows.map((r) => {
      const sno = Number(r.sno)
      const sanctionLimit = Number(r.sanctionLimit)
      const limitLiveDate = new Date(r.limitLiveDate)
      if (isNaN(sno) || isNaN(sanctionLimit) || isNaN(limitLiveDate))
        throw new Error('Invalid data types in CSV')
      return { ...r, sno, sanctionLimit, limitLiveDate }
    })

    // 5) Insert into Mongo
    const docs = await OnboardNotification.insertMany(toInsert)

    // 6) FTP upload
    try {
      // await uploadFileToFtp(filePath)
      res.json({
        message: 'File parsed and saved successfully',
        insertedCount: docs.length,
      })
    } catch (ftpErr) {
      console.error('FTP upload error:', ftpErr)
      // Optionally, you might want to handle FTP errors differently,
      // perhaps sending a different status or message to the client.
      // For now, we'll let the general error handling in the outer catch block handle it.
    }
  } catch (error) {
    console.error('CSV processing error:', error)
    res
      .status(500)
      .json({ message: 'Internal server error', error: error.message })
  } finally {
    // always delete temp file, even on error
    try {
      await unlink(filePath)
    } catch (unlinkErr) {
      console.warn('Failed to delete temp file:', unlinkErr)
    }
  }
}

export const getOnboardData = async (req, res) => {
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const companyName = String(req.query.companyName || '')
  const distributorCode = String(req.query.distributorCode || '')

  try {
    const filter = {}
    if (companyName) filter.companyName = new RegExp(companyName, 'i')
    if (distributorCode)
      filter.distributorCode = new RegExp(distributorCode, 'i')
    const skip = (Number(page) - 1) * Number(limit)
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
}
