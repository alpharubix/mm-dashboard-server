import csvParser from 'csv-parser'
import fs from 'fs'
import { unlink } from 'fs/promises'
import mongoose from 'mongoose'

import { CreditLimit } from '../../models/credit-limit.model.js'
import { toCamelCase } from '../../utils/index.js'
import { isValid, parse } from 'date-fns'
import { calculatePendingInvoices } from '../../utils/services.js'

export async function creditLimitCsvParseAndSave(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'city',
    'state',
    'lender',
    'limitExpiryDate',
    'sanctionLimit',
    'operativeLimit',
    'utilisedLimit',
    'availableLimit',
    'overdue',
    'billingStatus',
    'fundingType',
    'anchorId',
    'distributorPhone',
    'distributorEmail',
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
        duplicates: [...new Set(duplicateCodesInCSV)], // Use Set to get unique duplicates
      })
    }

    // Check if anchorId is same or no in one csv file.
    const duplicateAnchorId = rows.map((r) => r.anchorId)
    const isAllSame = new Set(duplicateAnchorId).size === 1
    if (!isAllSame) {
      return res.status(400).json({
        message: 'Anchor Id must be same in one file',
      })
    }

    // Get the anchorId from the first row to delete only that anchor's data
    const csvAnchorId = rows[0].anchorId

    // 4) Cast & prepare documents
    const toInsert = await Promise.all(
      rows.map(async (r) => {
        // Clean and parse numbers
        const sanctionLimit = Number(r.sanctionLimit.replace(/,/g, ''))
        const operativeLimit = Number(r.operativeLimit.replace(/,/g, ''))
        const utilisedLimit = Number(r.utilisedLimit.replace(/,/g, ''))
        const availableLimit = Number(r.availableLimit.replace(/,/g, ''))
        const overdue = Number(r.overdue.replace(/,/g, ''))
        const billingStatus = r.billingStatus.trim().toLowerCase()
        if (!['positive', 'negative'].includes(billingStatus)) {
          throw new Error(
            `Invalid billing status: ${billingStatus}. Must be 'positive' or 'negative'.`
          )
        }
        const fundingType = r.fundingType.trim().toLowerCase()
        if (!['open', 'close'].includes(fundingType)) {
          throw new Error(
            `Invalid funding type: ${fundingType}. Must be 'open' or 'close'.`
          )
        }
        if (!r.anchorId || r.anchorId.trim() === '') {
          throw new Error('Anchor ID is required and cannot be empty')
        }
        const companyName = r.companyName.trim()
        if (!companyName || companyName.length < 3) {
          throw new Error(
            'Company name is required and must be at least 3 characters long'
          )
        }
        const city = r.city.trim()
        if (!city || city.length < 2) {
          throw new Error(
            'City is required and must be at least 2 characters long'
          )
        }

        const state = r.state.trim()
        if (!state || state.length < 2) {
          throw new Error(
            'State is required and must be at least 2 characters long'
          )
        }

        const lender = r.lender.trim()
        if (!lender || lender.length < 3) {
          throw new Error(
            'Lender is required and must be at least 3 characters long'
          )
        }
        const distributorCode = r.distributorCode.trim()
        if (!distributorCode || distributorCode.length < 3) {
          throw new Error(
            'Distributor code is required and must be at least 3 characters long'
          )
        }
        const distributorPhone = r.distributorPhone.trim()
        if (!distributorPhone || distributorPhone.length !== 10) {
          throw new Error(
            'Distributor phone is required and must be 10 characters long'
          )
        }
        const distributorEmail = r.distributorEmail.trim()
        if (!distributorEmail || distributorEmail.length < 3) {
          throw new Error(
            'Distributor email is required and must be at least 3 characters long'
          )
        }
        const anchorId = r.anchorId
        const limitExpiryDate = parse(r.limitExpiryDate, 'dd-MM-yy', new Date())
        const pendingInvoices = await calculatePendingInvoices(
          r.distributorCode
        )

        if (!isValid(limitExpiryDate)) {
          throw new Error(`Invalid date format: ${r.limitExpiryDate}`)
        }

        // Validation
        if (
          isNaN(sanctionLimit) ||
          isNaN(operativeLimit) ||
          isNaN(utilisedLimit) ||
          isNaN(availableLimit) ||
          isNaN(overdue) ||
          typeof billingStatus !== 'string' ||
          billingStatus.trim() === ''
        ) {
          throw new Error('Invalid data types in CSV')
        }

        return {
          sanctionLimit,
          operativeLimit,
          utilisedLimit,
          availableLimit,
          overdue,
          billingStatus,
          limitExpiryDate,
          fundingType,
          anchorId,
          companyName,
          city,
          state,
          distributorCode,
          distributorPhone,
          distributorEmail,
          lender,
          pendingInvoices,
          currentAvailable: availableLimit - pendingInvoices,
        }
      })
    )
    // console.log({ toInsert })
    // 5) Database operations with session (All or Nothing)
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        // Clear previous data for this anchor
        await CreditLimit.deleteMany({ anchorId: csvAnchorId }, { session })

        // Insert new data
        insertedDocs = await CreditLimit.insertMany(toInsert, { session })
      })
    } finally {
      await session.endSession()
    }

    res.json({
      message: 'data saved successfully',
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
