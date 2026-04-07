import path from 'path'
import { Invoice } from '../../models/invoice.model.js'
import logger from '../../utils/logger.js'
import { uploadPdfToGcs } from '../../utils/pdf-upload.js'

export async function invoicePdf(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' })
    }

    const files = req.files
    const anchorId = req.user.companyId

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' })
    }

    const invoiceNumbers = files.map((f) =>
      path.parse(f.originalname).name.trim()
    )
    
    logger.info({ invoiceNumbers, anchorId }, 'PDF upload lookup')

    const existingInvoices = await Invoice.find({
      invoiceNumber: { $in: invoiceNumbers },
      anchorId,
    }).lean()

    logger.info({ found: existingInvoices.length }, 'Invoices found in DB')

    const invoiceMap = new Map(
      existingInvoices.map((inv) => [inv.invoiceNumber, inv])
    )

    let successCount = 0
    let skippedCount = 0
    const errors = []
    const skippedInvoices = []

    for (const file of files) {
      try {
        const invoiceNumber = path.parse(file.originalname).name.trim()

        if (file.mimetype !== 'application/pdf') {
          errors.push({ filename: file.originalname, error: 'Not a PDF' })
          continue
        }

        const existingInvoice = invoiceMap.get(invoiceNumber)

        if (!existingInvoice) {
          errors.push({
            filename: file.originalname,
            error: 'Invoice not found',
          })
          continue
        }

        if (existingInvoice.invoicePdfUrl) {
          skippedCount++
          skippedInvoices.push(invoiceNumber)
          continue
        }

        const destFileName = `anchors/${anchorId}/invoices/${file.originalname}`
        const publicUrl = await uploadPdfToGcs(file.buffer, destFileName)

        await Invoice.updateOne(
          { _id: existingInvoice._id },
          { invoicePdfUrl: publicUrl }
        )
        successCount++
      } catch (fileError) {
        logger.error(
          { err: fileError, filename: file.originalname },
          'PDF upload failed'
        )
        errors.push({ filename: file.originalname, error: 'Upload failed' })
      }
    }

    res.status(200).json({
      message: `${successCount} files uploaded, ${skippedCount} skipped (already exists)`,
      totalUploaded: successCount,
      totalSkipped: skippedCount,
      totalFiles: files.length,
      skippedInvoices: skippedInvoices.length > 0 ? skippedInvoices : [],
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error({ err: error }, 'invoicePdf handler failed')
    res.status(500).json({ error: 'Upload failed' })
  }
}
