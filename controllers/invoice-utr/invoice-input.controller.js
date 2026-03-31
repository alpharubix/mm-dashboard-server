import { EMAIL_STATUS, INV_STATUS } from '../../conf/index.js'

import { CreditLimit } from '../../models/credit-limit.model.js'
import { Invoice } from '../../models/invoice.model.js'

import { calculateBillingStatus } from '../../utils/index.js'
import { acquireLock, releaseLock } from '../../utils/recalculation-lock.js'
import { calculatePendingInvoices } from '../../utils/services.js'
import {
  checkAvailableLimit,
  isDistributorAllowed,
  isDistributorHasOverdue,
} from '../email/email-service/service.js'

export async function invoiceInput(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Forbidden Insufficient role' })
    }

    const invoices = req.body
    const anchorId = req.user.companyId

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ error: 'No invoice data provided' })
    }

    if (invoices.length > 1000) {
      return res
        .status(400)
        .json({ error: 'Too many invoices. Maximum 1000 per request' })
    }

    const validationErrors = {
      missingNumber: [],
      negativeInvoiceAmount: [],
      negativeLoanAmount: [],
      loanExceedsInvoice: [],
      invalidFormat: [],
    }

    invoices.forEach((inv, index) => {
      if (
        !inv.invoiceNumber ||
        typeof inv.invoiceNumber !== 'string' ||
        inv.invoiceNumber.trim() === ''
      ) {
        validationErrors.missingNumber.push(`Item at index ${index}`)
        return
      }

      const invNum = inv.invoiceNumber.trim()
      const invAmount = Number(inv.invoiceAmount)
      const loanAmount =
        inv.loanAmount !== undefined && inv.loanAmount !== null
          ? Number(inv.loanAmount)
          : null

      if (isNaN(invAmount) || (loanAmount !== null && isNaN(loanAmount))) {
        validationErrors.invalidFormat.push(invNum)
        return
      }

      if (invAmount < 0) {
        validationErrors.negativeInvoiceAmount.push(invNum)
      }

      if (loanAmount !== null) {
        if (loanAmount < 0) {
          validationErrors.negativeLoanAmount.push(invNum)
        } else if (loanAmount > invAmount) {
          validationErrors.loanExceedsInvoice.push(invNum)
        }
      }
    })

    if (
      validationErrors.missingNumber.length > 0 ||
      validationErrors.negativeInvoiceAmount.length > 0 ||
      validationErrors.negativeLoanAmount.length > 0 ||
      validationErrors.loanExceedsInvoice.length > 0 ||
      validationErrors.invalidFormat.length > 0
    ) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: validationErrors })
    }

    const invoiceNumbers = invoices.map((inv) => inv.invoiceNumber.trim())
    const duplicateNumbers = new Set()

    invoiceNumbers.forEach((num, index) => {
      if (
        invoiceNumbers.indexOf(num) !== index ||
        invoiceNumbers.lastIndexOf(num) !== index
      ) {
        duplicateNumbers.add(num)
      }
    })

    const uniqueInvoices = invoices.filter(
      (invoice) => !duplicateNumbers.has(invoice.invoiceNumber.trim())
    )

    const jsonDuplicatesCount = invoices.length - uniqueInvoices.length
    const jsonDuplicates = Array.from(duplicateNumbers)

    let successCount = 0
    let skippedCount = 0
    const errors = []
    const skippedInvoices = []

    const uniqueInvoiceNumbers = uniqueInvoices.map((inv) =>
      inv.invoiceNumber.trim()
    )

    const existingInvoices = await Invoice.find({
      invoiceNumber: { $in: uniqueInvoiceNumbers },
      anchorId,
    })
      .select('invoiceNumber')
      .lean()

    const existingNumbers = new Set(
      existingInvoices.map((inv) => inv.invoiceNumber)
    )

    for (const invoice of uniqueInvoices) {
      try {
        const invoiceNumber = invoice.invoiceNumber.trim()

        if (existingNumbers.has(invoiceNumber)) {
          skippedCount++
          skippedInvoices.push(invoiceNumber)
          continue
        }

        let emailStatus = EMAIL_STATUS.NOT_ELIGIBLE
        let updatedStatus = INV_STATUS.YET_TO_PROCESS
        const distributorCode = invoice.distributorCode

        if (await isDistributorAllowed(distributorCode)) {
          const locked = await acquireLock(distributorCode)

          if (!locked) {
            // Another recalculation running — safe fallback
            emailStatus = EMAIL_STATUS.INSUFF_AVAIL_LIMIT
            updatedStatus = INV_STATUS.PENDING_WITH_CUSTOMER
          } else {
            try {
              const hasOverdue = await isDistributorHasOverdue(distributorCode)

              if (hasOverdue) {
                emailStatus = EMAIL_STATUS.OVERDUE
                updatedStatus = INV_STATUS.PENDING_WITH_CUSTOMER
              } else {
                const isLimitAvailable = await checkAvailableLimit(
                  distributorCode,
                  invoice.loanAmount
                )
                if (isLimitAvailable) {
                  emailStatus = EMAIL_STATUS.ELIGIBLE
                  updatedStatus = INV_STATUS.YET_TO_PROCESS
                } else {
                  emailStatus = EMAIL_STATUS.INSUFF_AVAIL_LIMIT
                  updatedStatus = INV_STATUS.PENDING_WITH_CUSTOMER
                }
              }
            } finally {
              await releaseLock(distributorCode)
            }
          }
        }

        const invoiceData = {
          ...invoice,
          invoiceNumber,
          anchorId,
          fundingType: 'close',
          emailStatus,
          status: updatedStatus,
        }

        await Invoice.create(invoiceData)
        successCount++

        if (invoice.distributorCode) {
          try {
            const pendingInvoices = await calculatePendingInvoices(
              invoice.distributorCode
            )
            const creditLimit = await CreditLimit.findOne({
              distributorCode: invoice.distributorCode,
            })

            if (creditLimit) {
              const currentAvailable =
                creditLimit.availableLimit - pendingInvoices
              const billingStatus = calculateBillingStatus(
                currentAvailable,
                creditLimit.overdue
              )
              await CreditLimit.updateOne(
                { distributorCode: invoice.distributorCode },
                { $set: { pendingInvoices, currentAvailable, billingStatus } }
              )
            }
          } catch (updateError) {
            console.error(
              'Failed to update pending invoices:',
              updateError.message
            )
          }
        }
      } catch (invoiceError) {
        console.error('Invoice creation error:', invoiceError.message)
        errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: 'Creation failed',
        })
      }
    }

    const response = {
      message: `${successCount} invoice(s) created, ${skippedCount} skipped (already exists)${jsonDuplicatesCount > 0 ? `, ${jsonDuplicatesCount} removed (duplicates in request)` : ''}`,
      totalCreated: successCount,
      totalSkipped: skippedCount,
      totalDuplicatesRemoved: jsonDuplicatesCount,
      totalProcessed: uniqueInvoices.length,
      totalInvoices: invoices.length,
    }

    if (skippedInvoices.length > 0) response.skippedInvoices = skippedInvoices
    if (jsonDuplicates.length > 0) response.duplicatesRemoved = jsonDuplicates
    if (errors.length > 0) response.errors = errors

    res.status(200).json(response)
  } catch (error) {
    console.error('Invoice input error:', error.message)
    res.status(500).json({ error: 'Invoice creation failed' })
  }
}
