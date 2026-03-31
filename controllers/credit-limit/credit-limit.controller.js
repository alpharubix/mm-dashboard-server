import csvParser from 'csv-parser'
import { isValid, parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'
import mongoose from 'mongoose'

import { EMAIL_STATUS, INV_STATUS } from '../../conf/index.js'
import { CreditLimit } from '../../models/credit-limit.model.js'
import { Invoice } from '../../models/invoice.model.js'
import { calculateBillingStatus, toCamelCase } from '../../utils/index.js'
import { acquireLock, releaseLock } from '../../utils/recalculation-lock.js'
import { calculatePendingInvoices } from '../../utils/services.js'
import {
  getInvoicesBasedOnEmailStatus,
  getInvoicesBasedOnStatus,
  isDistributorAllowed,
  updateInvoiceStatus,
} from '../email/email-service/service.js'

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
  let insertedDocs

  try {
    // 1) Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser({ mapHeaders: ({ header }) => toCamelCase(header) }))
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

    // 3) Duplicate distributorCode check within CSV
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

    // 4) Single anchorId check
    const anchorIds = rows.map((r) => r.anchorId)
    if (new Set(anchorIds).size !== 1) {
      return res
        .status(400)
        .json({ message: 'Anchor Id must be same in one file' })
    }
    const csvAnchorId = rows[0].anchorId

    // 5) Cast & validate rows
    const toInsert = await Promise.all(
      rows.map(async (r) => {
        const sanctionLimit = Number(r.sanctionLimit.replace(/,/g, ''))
        const operativeLimit = Number(r.operativeLimit.replace(/,/g, ''))
        const utilisedLimit = Number(r.utilisedLimit.replace(/,/g, ''))
        const availableLimit = Number(r.availableLimit.replace(/,/g, ''))
        const overdue = Number(r.overdue.replace(/,/g, ''))

        if (
          isNaN(sanctionLimit) ||
          isNaN(operativeLimit) ||
          isNaN(utilisedLimit) ||
          isNaN(availableLimit) ||
          isNaN(overdue)
        ) {
          throw new Error('Invalid numeric data in CSV')
        }

        const fundingType = r.fundingType.trim().toLowerCase()
        if (!['open', 'close'].includes(fundingType)) {
          throw new Error(
            `Invalid funding type: ${fundingType}. Must be 'open' or 'close'.`
          )
        }

        const anchorId = r.anchorId?.trim()
        if (!anchorId)
          throw new Error('Anchor ID is required and cannot be empty')

        const companyName = r.companyName.trim()
        if (!companyName || companyName.length < 3)
          throw new Error('Company name must be at least 3 characters')

        const city = r.city.trim()
        if (!city || city.length < 2)
          throw new Error('City must be at least 2 characters')

        const state = r.state.trim()
        if (!state || state.length < 2)
          throw new Error('State must be at least 2 characters')

        const lender = r.lender.trim()
        if (!lender || lender.length < 3)
          throw new Error('Lender must be at least 3 characters')

        const distributorCode = r.distributorCode.trim()
        if (!distributorCode || distributorCode.length < 3)
          throw new Error('Distributor code must be at least 3 characters')

        const distributorPhone = r.distributorPhone.trim()
        if (!distributorPhone || distributorPhone.length !== 10)
          throw new Error('Distributor phone must be 10 digits')

        const distributorEmail = r.distributorEmail.trim()
        if (!distributorEmail || distributorEmail.length < 3)
          throw new Error('Distributor email must be at least 3 characters')

        const limitExpiryDate = parse(r.limitExpiryDate, 'dd-MM-yy', new Date())
        if (!isValid(limitExpiryDate))
          throw new Error(`Invalid date format: ${r.limitExpiryDate}`)

        const pendingInvoices = await calculatePendingInvoices(distributorCode)
        const currentAvailable = availableLimit - pendingInvoices
        const billingStatus = calculateBillingStatus(currentAvailable, overdue)

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
          currentAvailable,
        }
      })
    )

    // 6) Save new credit limits FIRST
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await CreditLimit.deleteMany({ anchorId: csvAnchorId }, { session })
        insertedDocs = await CreditLimit.insertMany(toInsert, { session })
      })
    } finally {
      await session.endSession()
    }

    // 7) Recalculate invoice statuses against fresh limit data
    await Promise.all(
      toInsert.map(async (limit) => {
        const distCode = limit.distributorCode
        const isDistWhiteListed = await isDistributorAllowed(distCode)
        if (!isDistWhiteListed) return

        const locked = await acquireLock(distCode)
        if (!locked) {
          console.warn(
            `Recalculation skipped for ${distCode} — already in progress`
          )
          return
        }

        try {
          if (limit.overdue === 0) {
            // 1. Clear overdue flags first
            const overdueInvoices = await getInvoicesBasedOnEmailStatus(
              distCode,
              [EMAIL_STATUS.OVERDUE]
            )
            await updateInvoiceStatus(
              overdueInvoices,
              EMAIL_STATUS.ELIGIBLE,
              'emailStatus'
            )
            await updateInvoiceStatus(
              overdueInvoices,
              INV_STATUS.YET_TO_PROCESS,
              'status'
            )

            // 2. Get ALL active invoices in createdAt order
            const activeInvoices = await Invoice.find({
              distributorCode: distCode,
              status: {
                $nin: [INV_STATUS.PROCESSED, INV_STATUS.NOT_PROCESSED],
              },
              emailStatus: {
                $nin: [EMAIL_STATUS.NOT_ELIGIBLE, EMAIL_STATUS.SENT],
              },
            }).sort({ createdAt: 1 })

            // 3. Walk through in order, assign eligible until limit exhausted
            let runningTotal = 0
            const eligibleInvoices = []
            const insufficientInvoices = []

            for (const invoice of activeInvoices) {
              runningTotal += invoice.loanAmount
              if (runningTotal <= limit.availableLimit) {
                eligibleInvoices.push(invoice)
              } else {
                insufficientInvoices.push(invoice)
              }
            }

            // 4. Update eligible invoices
            if (eligibleInvoices.length > 0) {
              await updateInvoiceStatus(
                eligibleInvoices,
                INV_STATUS.YET_TO_PROCESS,
                'status'
              )
              await updateInvoiceStatus(
                eligibleInvoices,
                EMAIL_STATUS.ELIGIBLE,
                'emailStatus'
              )
            }

            // 5. Update insufficient invoices
            if (insufficientInvoices.length > 0) {
              await updateInvoiceStatus(
                insufficientInvoices,
                INV_STATUS.PENDING_WITH_CUSTOMER,
                'status'
              )
              await updateInvoiceStatus(
                insufficientInvoices,
                EMAIL_STATUS.INSUFF_AVAIL_LIMIT,
                'emailStatus'
              )
            }
          } else {
            // Has overdue — mark all eligible as overdue
            const eligibleInvoices = await getInvoicesBasedOnEmailStatus(
              distCode,
              [EMAIL_STATUS.ELIGIBLE]
            )
            await updateInvoiceStatus(
              eligibleInvoices,
              EMAIL_STATUS.OVERDUE,
              'emailStatus'
            )
            await updateInvoiceStatus(
              eligibleInvoices,
              INV_STATUS.PENDING_WITH_CUSTOMER,
              'status'
            )
          }
        } finally {
          await releaseLock(distCode)
        }
      })
    )

    return res.status(200).json({
      message: 'Data saved successfully',
      insertedCount: insertedDocs.length,
    })
  } catch (err) {
    console.error('Error processing CSV:', err)
    return res
      .status(500)
      .json({ message: 'Failed to process CSV', error: err.message })
  } finally {
    try {
      await unlink(filePath)
    } catch (unlinkErr) {
      console.warn('Failed to delete temp file:', unlinkErr)
    }
  }
}
