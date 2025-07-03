import path from 'path'
import { Invoice } from '../../models/invoice.model.js'
import { uploadPdfToGcs } from '../../utils/pdf-upload.js'

export async function invoicePdf(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Forbidden Insufficent role' })
    }
    const files = req.files
    const anchorId = req.user.companyId

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' })
    }

    let successCount = 0
    let skippedCount = 0
    const errors = []

    for (const file of files) {
      try {
        // Get invoice number from filename (removes .pdf)
        const invoiceNumber = parseInt(path.parse(file.originalname).name)

        // Check if invoice exists for this anchor
        const existingInvoice = await Invoice.findOne({
          invoiceNumber,
          anchorId,
        })

        if (!existingInvoice) {
          errors.push({
            filename: file.originalname,
            error: 'Invoice not found',
          })
          continue
        }

        // Check if PDF already uploaded - skip to prevent duplicate GCS uploads
        if (existingInvoice.invoicePdfUrl) {
          skippedCount++
          continue
        }

        // Upload to GCS: anchors/123/invoices/10019.pdf
        const destFileName = `anchors/${anchorId}/invoices/${file.originalname}`
        const publicUrl = await uploadPdfToGcs(file.buffer, destFileName)

        // Update invoice with PDF URL
        await Invoice.updateOne(
          { _id: existingInvoice._id },
          { invoicePdfUrl: publicUrl }
        )

        successCount++
      } catch (fileError) {
        console.log(fileError)
        errors.push({
          filename: file.originalname,
          error: 'Upload failed',
        })
      }
    }

    res.json({
      message: `${successCount} files uploaded, ${skippedCount} skipped (already exists)`,
      totalUploaded: successCount,
      totalSkipped: skippedCount,
      totalFiles: files.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' })
  }
}
