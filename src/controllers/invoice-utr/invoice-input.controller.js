import { OutputUTR } from '../../models/output-utr.model.js'

export async function invoiceInput(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Forbidden Insufficent role' })
    }
    const invoices = req.body

    const invoicesToInsert = invoices.map((invoice) => ({
      ...invoice,
      anchorId: req.user.companyId,
      fundingType: 'close',
    }))

    const invoiceNumbers = invoicesToInsert.map((inv) => inv.invoiceNumber)

    // Check for duplicates within the request data
    const duplicatesInRequest = invoiceNumbers.filter(
      (num, index) => invoiceNumbers.indexOf(num) !== index
    )

    if (duplicatesInRequest.length > 0) {
      return res.status(400).json({
        error: 'Duplicate invoice numbers found in request data',
        duplicateInvoiceNumbers: [...new Set(duplicatesInRequest)],
      })
    }

    // Check for existing duplicates in database
    const existingInvoices = await OutputUTR.find({
      invoiceNumber: { $in: invoiceNumbers },
    }).select('invoiceNumber')

    if (existingInvoices.length > 0) {
      const duplicateNumbers = existingInvoices.map((inv) => inv.invoiceNumber)
      return res.status(400).json({
        error: 'Invoice numbers already exist in database',
        duplicateInvoiceNumbers: duplicateNumbers,
      })
    }

    await OutputUTR.insertMany(invoicesToInsert)

    res.status(201).json({
      message: `${invoices.length} invoice(s) created successfully`,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
