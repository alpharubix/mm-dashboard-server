import { Invoice } from '../../models/invoice.model.js'

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
    const duplicatesInRequest = invoiceNumbers.filter(
      (num, index) => invoiceNumbers.indexOf(num) !== index
    )

    if (duplicatesInRequest.length > 0) {
      return res.status(400).json({
        error: 'Duplicate invoice number(s) found in the request data',
        duplicates: [...new Set(duplicatesInRequest)],
      })
    }

    let successCount = 0
    let skippedCount = 0
    const errors = []
    const skippedInvoices = []

    // Batch check existing invoices (performance optimization)
    const existingInvoices = await Invoice.find({
      invoiceNumber: { $in: invoiceNumbers },
      anchorId,
    })
      .select('invoiceNumber')
      .lean()

    const existingNumbers = new Set(
      existingInvoices.map((inv) => inv.invoiceNumber)
    )

    // Process invoices
    for (const invoice of invoices) {
      try {
        const invoiceNumber = invoice.invoiceNumber.trim()

        // Skip if already exists
        if (existingNumbers.has(invoiceNumber)) {
          skippedCount++
          skippedInvoices.push(invoiceNumber)
          continue
        }

        // Create invoice with controlled data
        const invoiceData = {
          ...invoice,
          invoiceNumber,
          anchorId,
          fundingType: 'close',
        }

        await Invoice.create(invoiceData)
        successCount++
      } catch (invoiceError) {
        console.error('Invoice creation error:', invoiceError.message)
        errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: 'Creation failed',
        })
      }
    }

    res.status(200).json({
      message: `${successCount} invoice(s) created, ${skippedCount} skipped (already exists)`,
      totalCreated: successCount,
      totalSkipped: skippedCount,
      totalInvoices: invoices.length,
      skippedInvoices: skippedInvoices.length > 0 ? skippedInvoices : [],
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Invoice input error:', error.message)
    res.status(500).json({ error: 'Invoice creation failed' })
  }
}

// https://claude.ai/chat/6635d129-453b-4942-9c06-d9416a05d4ac
