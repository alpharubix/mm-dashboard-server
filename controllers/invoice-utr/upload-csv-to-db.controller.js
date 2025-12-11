import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { EMAIL_STATUS, INV_STATUS, NULL_VALUES } from '../../conf/index.js'
import { CreditLimit } from '../../models/credit-limit.model.js'
import { Invoice } from '../../models/invoice.model.js'
import { toCamelCase } from '../../utils/index.js'
import { calculatePendingInvoices } from '../../utils/services.js'
import {
  isDistributorAllowed,
  updateInvoiceStatus,
} from '../email/email-service/service.js'

function normalizeValue(value) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  return NULL_VALUES.includes(trimmed) ? null : trimmed
}

export async function invoiceCsvParseAndSave(req, res) {
  // All required CSV fields (for header validation)
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
    'anchorId',
    'distributorPhone',
    'distributorEmail',
    'fundingType',
  ]

  // Fields that will be updated in database
  const updateableFields = [
    'loanDisbursementDate',
    'utr',
    'status',
    'loanAmount',
  ]

  if (!req.file?.path) {
    return res.status(400).json({ message: 'No file uploaded' })
  }

  // File size check - 15MB limit
  if (req.file.size > 15 * 1024 * 1024) {
    return res
      .status(400)
      .json({ message: 'File too large. Maximum size is 15MB' })
  }

  const filePath = req.file.path
  const rows = []
  let currentRowNumber = 0

  try {
    // 1) Parse CSV into rows[]
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => toCamelCase(header),
          })
        )
        .on('data', (row) => {
          currentRowNumber++
          rows.push({ ...row, _rowNumber: currentRowNumber })
        })
        .on('end', resolve)
        .on('error', reject)
    })

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV is empty' })
    }

    // 2) Header validation - check all required fields are present, ignore extra fields
    const csvFields = Object.keys(rows[0]).filter(
      (field) => field !== '_rowNumber'
    )
    const missing = requiredFields.filter((f) => !csvFields.includes(f))

    if (missing.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields in CSV',
        missingFields: missing,
        requiredFields: requiredFields,
      })
    }

    // 3) Check for duplicate invoiceNumbers within CSV
    const invoiceNumbers = rows
      .map((r) => r.invoiceNumber?.toString()?.trim())
      .filter(Boolean)
    const duplicatesInCSV = invoiceNumbers.filter(
      (item, index) => invoiceNumbers.indexOf(item) !== index
    )
    if (duplicatesInCSV.length) {
      return res.status(400).json({
        message: 'Duplicate invoiceNumbers found in CSV',
        duplicates: [...new Set(duplicatesInCSV)],
      })
    }

    // 4) Process and validate each row
    const updateOps = []
    const processingErrors = []
    const skippedRows = []

    for (const r of rows) {
      try {
        // Normalize all values first
        const normalized = {}
        Object.keys(r).forEach((key) => {
          if (key !== '_rowNumber') {
            normalized[key] = normalizeValue(r[key])
          }
        })

        // Required fields validation
        if (!normalized.invoiceNumber) {
          throw new Error(`Invoice number is required`)
        }

        if (!normalized.distributorCode) {
          throw new Error(`Distributor code is required`)
        }

        // Build update fields - only the fields we want to update
        const updateFields = {}

        // Handle loanAmount
        if (normalized.loanAmount) {
          const cleanAmount = normalized.loanAmount
            .toString()
            .replace(/,/g, '')
            .trim()
          const loanAmount = Number(cleanAmount)

          if (Number.isNaN(loanAmount) || loanAmount <= 0) {
            throw new Error(`Invalid loan amount: "${normalized.loanAmount}"`)
          }
          updateFields.loanAmount = loanAmount
        }

        // Handle loanDisbursementDate
        if (normalized.loanDisbursementDate) {
          const loanDate = parse(
            normalized.loanDisbursementDate,
            'dd-MM-yy',
            new Date()
          )
          if (!Number.isNaN(loanDate.getTime())) {
            updateFields.loanDisbursementDate = loanDate
          } else {
            throw new Error(
              `Invalid loan disbursement date format: "${normalized.loanDisbursementDate}". Use dd-MM-yy`
            )
          }
        }

        // Handle utr
        if (csvFields.includes('utr')) {
          updateFields.utr = normalized.utr
        }

        // Handle status
        if (normalized.status) {
          const _status = toCamelCase(normalized.status)
          const validStatuses = [
            'yetToProcess',
            'inProgress',
            'processed',
            'pendingWithCustomer',
            'pendingWithLender',
            'notProcessed',
          ]

          if (validStatuses.includes(_status)) {
            updateFields.status = _status
            //check if the invoice if from whitelisted distributors
            const isDistWhiteListed = await isDistributorAllowed(
              normalized.distributorCode
            )
            if (isDistWhiteListed) {
              if (_status === INV_STATUS.PROCESSED) {
                await updateInvoiceStatus(
                  normalized.invoiceNumber,
                  EMAIL_STATUS.SENT,
                  'emailStatus'
                )
              }
              if (_status === INV_STATUS.NOT_PROCESSED) {
                await updateInvoiceStatus(
                  normalized.invoiceNumber,
                  EMAIL_STATUS.NOT_ELIGIBLE,
                  'emailStatus'
                )
              }
            }
          } else {
            throw new Error(
              `Invalid status: "${normalized.status}". Valid options: ${validStatuses.join(', ')}`
            )
          }
        }

        // Only proceed if we have fields to update
        if (Object.keys(updateFields).length === 0) {
          skippedRows.push({
            invoiceNumber: normalized.invoiceNumber,
            rowNumber: r._rowNumber,
            reason: `No valid update fields found. Expected: ${updateableFields.join(', ')}`,
          })
          continue
        }

        updateOps.push({
          updateOne: {
            filter: { invoiceNumber: normalized.invoiceNumber },
            update: { $set: updateFields },
          },
        })

        // Update credit limit if distributorCode exists
        if (normalized.distributorCode) {
          try {
            const pendingInvoices = await calculatePendingInvoices(
              normalized.distributorCode
            )
            const creditLimit = await CreditLimit.findOne({
              distributorCode: normalized.distributorCode,
            })

            if (creditLimit) {
              const currentAvailable =
                creditLimit.availableLimit - pendingInvoices

              await CreditLimit.updateOne(
                { distributorCode: normalized.distributorCode },
                { $set: { pendingInvoices, currentAvailable } }
              )
            }
          } catch (updateError) {
            console.error(
              `Failed to update credit limit for invoice ${normalized.invoiceNumber}:`,
              updateError.message
            )
            // Don't fail the whole operation, just log the error
          }
        }
      } catch (error) {
        processingErrors.push({
          invoiceNumber: r.invoiceNumber || 'Unknown',
          rowNumber: r._rowNumber,
          error: error.message,
        })
      }
    }

    // 5) Execute bulk operations
    let result = { matchedCount: 0, modifiedCount: 0 }
    if (updateOps.length > 0) {
      try {
        result = await Invoice.bulkWrite(updateOps, { ordered: false })
      } catch (bulkError) {
        console.error('Bulk write error:', bulkError)
        // Extract individual errors if available
        if (bulkError.writeErrors) {
          bulkError.writeErrors.forEach((err) => {
            const failedOp = updateOps[err.index]
            const invoiceNumber =
              failedOp?.updateOne?.filter?.invoiceNumber || 'Unknown'
            processingErrors.push({
              invoiceNumber: invoiceNumber,
              rowNumber: 'Unknown',
              error: err.errmsg || 'Database write error',
            })
          })
        }
      }
    }

    // 6) Prepare response
    const totalRows = rows.length
    const successfulRows = result.modifiedCount || 0
    const errorCount = processingErrors.length
    const skippedCount = skippedRows.length
    const notFoundCount = Math.max(0, updateOps.length - result.matchedCount)

    const response = {
      message: `File processed. ${successfulRows} updated, ${errorCount} errors, ${skippedCount} skipped, ${notFoundCount} not found in database.`,
      totalRows,
      successfulRows,
      errorCount,
      skippedCount,
      notFoundCount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    }

    if (errorCount > 0) {
      response.errors = processingErrors
    }

    if (skippedCount > 0) {
      response.skippedRows = skippedRows
    }

    // Return appropriate status code
    const hasIssues = errorCount > 0 || skippedCount > 0 || notFoundCount > 0
    res.status(hasIssues ? 207 : 200).json(response)
  } catch (err) {
    console.error('Error processing CSV:', err)
    res.status(500).json({
      message: 'Failed to process CSV file',
      error: err.message,
    })
  } finally {
    try {
      await unlink(filePath)
      console.log(`Temporary file ${filePath} deleted.`)
    } catch (unlinkErr) {
      console.warn('Failed to delete temp file:', unlinkErr)
    }
  }
}
