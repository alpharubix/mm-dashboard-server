import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import { unlink } from 'fs/promises'

import { EMAIL_STATUS, INV_STATUS, INVOICE_PAYMENT_STATUS, NULL_VALUES } from '../../conf/index.js'
import { CreditLimit } from '../../models/credit-limit.model.js'
import { Invoice } from '../../models/invoice.model.js'
import { computeInvoiceAgeing, getPaymentDueDays, toCamelCase } from '../../utils/index.js'
import { calculatePendingInvoices } from '../../utils/services.js'
import {
  isDistributorAllowed,
  updateInvoiceStatus,
} from '../email/email-service/service.js'

function parseFlexibleDate(val) {
  if (!val) return null
  const str = val.toString().trim()
  const formats = [
    'dd-MM-yy',
    'dd-MM-yyyy',
    'yyyy-MM-dd',
    'dd/MM/yy',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'd-M-yy',
    'd-M-yyyy',
  ]
  for (const fmt of formats) {
    const d = parse(str, fmt, new Date())
    if (!Number.isNaN(d.getTime())) {
      return d
    }
  }
  const iso = new Date(str)
  if (!Number.isNaN(iso.getTime())) {
    return iso
  }
  return null
}

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
    'lenderName',
    'invoicePaymentStatus',
    'paymentReceivedDate',
  ]

  // Fields that will be updated in database
  const updateableFields = [
    'loanDisbursementDate',
    'utr',
    'status',
    'loanAmount',
    'lenderName',
    'invoicePaymentStatus',
    'paymentReceivedDate',
    'paymentDueDays',
    'paymentDueDate',
    'currentAgeingDays',
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
          // Check if row has at least one non-empty value (ignoring _rowNumber)
          const hasAnyValue = Object.keys(row).some((key) => {
            const val = row[key]
            if (val === undefined || val === null) return false
            const trimmed = String(val).trim()
            if (trimmed === '') return false
            return !NULL_VALUES.includes(trimmed)
          })

          if (hasAnyValue) {
            rows.push({ ...row, _rowNumber: currentRowNumber })
          }
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

    // 4) Fetch existing invoices from DB for fallback during calculations
    const existingInvoices = await Invoice.find({
      invoiceNumber: { $in: invoiceNumbers },
    })
      .select(
        'invoiceNumber anchorId loanDisbursementDate lenderName invoicePaymentStatus paymentReceivedDate paymentDueDays'
      )
      .lean()
    const invoiceDbMap = new Map(
      existingInvoices.map((inv) => [inv.invoiceNumber, inv])
    )

    // 5) Process and validate each row
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

        // Skip row if it has no meaningful data or if both invoiceNumber and distributorCode are missing
        const hasMeaningfulData = Object.values(normalized).some(
          (val) => val !== null && val !== undefined && val !== ''
        )
        if (!hasMeaningfulData || (!normalized.invoiceNumber && !normalized.distributorCode)) {
          continue
        }

        // Required fields validation
        if (!normalized.invoiceNumber) {
          throw new Error(`Invoice number is required`)
        }

        if (!normalized.distributorCode) {
          throw new Error(`Distributor code is required`)
        }

        const dbInvoice = invoiceDbMap.get(normalized.invoiceNumber) || {}

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
          const loanDate = parseFlexibleDate(normalized.loanDisbursementDate)
          if (loanDate) {
            updateFields.loanDisbursementDate = loanDate
          } else {
            throw new Error(
              `Invalid loan disbursement date format: "${normalized.loanDisbursementDate}". Expected dd-MM-yy or dd-MM-yyyy`
            )
          }
        }

        // Handle lenderName
        const lenderVal = normalized.lenderName || normalized.lender
        if (lenderVal) {
          updateFields.lenderName = lenderVal.trim()
        }

        // Handle invoicePaymentStatus ('Pending Payment', 'Paid', 'Overdue')
        if (normalized.invoicePaymentStatus) {
          const rawStatus = normalized.invoicePaymentStatus.trim()
          const matchedStatus = Object.values(INVOICE_PAYMENT_STATUS).find(
            (s) => s.toLowerCase() === rawStatus.toLowerCase()
          )
          if (matchedStatus) {
            updateFields.invoicePaymentStatus = matchedStatus
          } else {
            throw new Error(
              `Invalid invoice payment status: "${normalized.invoicePaymentStatus}". Valid options: Pending Payment, Paid, Overdue`
            )
          }
        }

        // Handle paymentReceivedDate
        if (normalized.paymentReceivedDate) {
          const receivedDate = parseFlexibleDate(normalized.paymentReceivedDate)
          if (receivedDate) {
            updateFields.paymentReceivedDate = receivedDate
          } else {
            throw new Error(
              `Invalid payment received date format: "${normalized.paymentReceivedDate}". Expected dd-MM-yy or dd-MM-yyyy`
            )
          }
        }

        // Compute Ageing and Payment Due calculations
        const lddForCalc =
          updateFields.loanDisbursementDate ||
          dbInvoice.loanDisbursementDate ||
          null
        const lenderForCalc =
          updateFields.lenderName ||
          normalized.lenderName ||
          dbInvoice.lenderName ||
          null
        const anchorForCalc =
          normalized.anchorId || dbInvoice.anchorId || null
        const paymentStatusForCalc =
          updateFields.invoicePaymentStatus ||
          normalized.invoicePaymentStatus ||
          dbInvoice.invoicePaymentStatus ||
          null
        const paymentReceivedDateForCalc =
          updateFields.paymentReceivedDate ||
          dbInvoice.paymentReceivedDate ||
          null

        const dueDays = getPaymentDueDays(lenderForCalc, anchorForCalc)
        if (dueDays !== null && dueDays !== undefined) {
          updateFields.paymentDueDays = dueDays
          if (lddForCalc) {
            const dueDate = new Date(lddForCalc)
            dueDate.setDate(dueDate.getDate() + dueDays)
            updateFields.paymentDueDate = dueDate
          }
        }

        if (lddForCalc) {
          const isPaid = (paymentStatusForCalc || '').toLowerCase() === 'paid'
          const endDate =
            isPaid && paymentReceivedDateForCalc
              ? new Date(paymentReceivedDateForCalc)
              : new Date()
          const diffTime = endDate.getTime() - new Date(lddForCalc).getTime()
          updateFields.currentAgeingDays = Math.max(
            0,
            Math.floor(diffTime / (1000 * 60 * 60 * 24))
          )
        }

        // Handle utr
        if (csvFields.includes('utr')) {
          updateFields.utr = normalized.utr
        }

        // Handle status
        if (
          normalized.status ||
          (r.status !== undefined &&
            r.status !== null &&
            String(r.status).trim() !== '')
        ) {
          const rawStatus = String(normalized.status || r.status).trim()
          const cleanStatus = rawStatus.toLowerCase().replace(/[^a-z]/g, '')
          const statusMap = {
            yettoprocess: INV_STATUS.YET_TO_PROCESS,
            inprogress: INV_STATUS.IN_PROGRESS,
            processed: INV_STATUS.PROCESSED,
            pendingwithcustomer: INV_STATUS.PENDING_WITH_CUSTOMER,
            pendingwithlender: INV_STATUS.PENDING_WITH_LENDER,
            notprocessed: INV_STATUS.NOT_PROCESSED,
          }

          // If valid status, use it; otherwise silently default to yetToProcess without error
          const _status = statusMap[cleanStatus] || INV_STATUS.YET_TO_PROCESS
          updateFields.status = _status

          try {
            // check if the invoice is from whitelisted distributors
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
          } catch (distErr) {
            console.warn(
              `Failed checking whitelist for distributor ${normalized.distributorCode}:`,
              distErr.message
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
