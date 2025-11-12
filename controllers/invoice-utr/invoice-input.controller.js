import { EMAIL_STATUS, INV_STATUS } from '../../conf/index.js'

import { CreditLimit } from '../../models/credit-limit.model.js'
import { Invoice } from '../../models/invoice.model.js'

import { calculateBillingStatus } from '../../utils/index.js'
import { calculatePendingInvoices } from '../../utils/services.js'
import {
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

    // Input validation
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ error: 'No invoice data provided' })
    }

    // Rate limiting - prevent abuse
    if (invoices.length > 1000) {
      return res
        .status(400)
        .json({ error: 'Too many invoices. Maximum 1000 per request' })
    }

    // Validate required fields upfront
    const invalidInvoices = invoices.filter(
      (inv) =>
        !inv.invoiceNumber ||
        typeof inv.invoiceNumber !== 'string' ||
        inv.invoiceNumber.trim() === ''
    )

    if (invalidInvoices.length > 0) {
      return res.status(400).json({
        error:
          'Invalid invoice data. invoiceNumber is required and must be non-empty string',
        invalidCount: invalidInvoices.length,
      })
    }

    // Check for duplicates in request data
    const invoiceNumbers = invoices.map((inv) => inv.invoiceNumber.trim())
    const duplicateNumbers = new Set()

    // Find which invoice numbers appear more than once
    invoiceNumbers.forEach((num, index) => {
      if (
        invoiceNumbers.indexOf(num) !== index ||
        invoiceNumbers.lastIndexOf(num) !== index
      ) {
        duplicateNumbers.add(num)
      }
    })

    // Filter out ALL invoices with duplicate numbers
    const uniqueInvoices = invoices.filter(
      (invoice) => !duplicateNumbers.has(invoice.invoiceNumber.trim())
    )

    const jsonDuplicatesCount = invoices.length - uniqueInvoices.length
    const jsonDuplicates = Array.from(duplicateNumbers)

    let successCount = 0
    let skippedCount = 0
    const errors = []
    const skippedInvoices = []

    // Get unique invoice numbers for DB check
    const uniqueInvoiceNumbers = uniqueInvoices.map((inv) =>
      inv.invoiceNumber.trim()
    )

    // Batch check existing invoices (performance optimization)
    const existingInvoices = await Invoice.find({
      invoiceNumber: { $in: uniqueInvoiceNumbers },
      anchorId,
    })
      .select('invoiceNumber')
      .lean()

    const existingNumbers = new Set(
      existingInvoices.map((inv) => inv.invoiceNumber)
    )

    // Process invoices
    for (const invoice of uniqueInvoices) {
      try {
        const invoiceNumber = invoice.invoiceNumber.trim()

        // Skip if already exists
        if (existingNumbers.has(invoiceNumber)) {
          skippedCount++
          skippedInvoices.push(invoiceNumber)
          continue
        }
        console.log('Logging invoice before', invoice)
        let emailStatus = EMAIL_STATUS.NOT_ELIGIBLE // Set default emailstatus
        let updatedStatus = INV_STATUS.YET_TO_PROCESS //set default status
        const distributorCode = invoice.distributorCode

        // Check whitelisting status first
        if (await isDistributorAllowed(distributorCode)) {
          // If whitelisted, check the overdue status once and store the result
          const hasOverdue = await isDistributorHasOverdue(distributorCode)

          // Log the result as in your original code
          console.log('overdue-check-result', hasOverdue)

          // Determine the final status
          emailStatus = hasOverdue
            ? EMAIL_STATUS.OVERDUE
            : EMAIL_STATUS.ELIGIBLE
          if (hasOverdue) {
            updatedStatus = INV_STATUS.PENDING_WITH_CUSTOMER
          }
        }
        // emailStatus is now correctly set to 'notEligible', 'overdue', or 'eligible'
        // Create invoice with controlled data
        const invoiceData = {
          ...invoice,
          invoiceNumber,
          anchorId,
          fundingType: 'close',
          emailStatus,
          status: updatedStatus,
        }
        console.log('Logging invoice after ', invoiceData)
        await Invoice.create(invoiceData)
        successCount++

        // Update pending invoices calculation
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
            // Don't fail the whole operation, just log the error
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

    // Build comprehensive response
    const response = {
      message: `${successCount} invoice(s) created, ${skippedCount} skipped (already exists)${jsonDuplicatesCount > 0 ? `, ${jsonDuplicatesCount} removed (duplicates in request)` : ''}`,
      totalCreated: successCount,
      totalSkipped: skippedCount,
      totalDuplicatesRemoved: jsonDuplicatesCount,
      totalProcessed: uniqueInvoices.length,
      totalInvoices: invoices.length,
    }

    // Add optional arrays only if they have data
    if (skippedInvoices.length > 0) {
      response.skippedInvoices = skippedInvoices
    }

    if (jsonDuplicates.length > 0) {
      response.duplicatesRemoved = jsonDuplicates
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Invoice input error:', error.message)
    res.status(500).json({ error: 'Invoice creation failed' })
  }
}

// v1 https://claude.ai/chat/6635d129-453b-4942-9c06-d9416a05d4ac
// v2 https://claude.ai/chat/60e01997-1735-4057-84ad-d5461e4a4591
