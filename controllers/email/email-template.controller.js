import { EmailTemplate } from '../../models/email-template.model.js'
import { Invoice } from '../../models/invoice.model.js'
import {
  generateInvoiceAttachments,
  getFormatedEmailBody,
  getFormatedSubject,
  getLenderTemplate,
} from './email-service/service.js'

export async function saveEmailTemplate(req, res) {
  try {
    const template = req.body
    // Check if body is empty
    if (!template || Object.keys(template).length === 0) {
      return res.status(400).json({ error: 'Request body cannot be empty.' })
    }
    const requiredFields = ['templateId', 'from', 'to', 'cc', 'subject', 'body']
    //check for any missing fields in the body
    const missingFileds = requiredFields.filter((field) => !template[field])
    if (missingFileds.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFileds.join(', ')}`,
      })
    }
    //if the request contains the proper email template data insert in into the db
    await EmailTemplate.insertOne(template)
    return res
      .status(201)
      .json({ message: 'Email-template saved successfully' })
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export async function getTemplate(req, res) {
  try {
    const distributorCode = req.query.distributorCode
    const invoiceNumber = req.query.invoiceNumber
    if (!distributorCode || !invoiceNumber) {
      return res
        .status(400)
        .json({ message: 'Both distributorCode and invoiceNumber is required' })
    }

    const emailtemplate = await getLenderTemplate(distributorCode)
    if (!emailtemplate) {
      return res
        .status(404)
        .json({ message: "No template found for this distributor's Lender" })
    }

    const invoice = await Invoice.findOne({ invoiceNumber }).lean()
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' })
    }

    // generate csv (same helper you already have)
    const attachmentsArr = await generateInvoiceAttachments(invoice)
    const csvAttachment = attachmentsArr.find(
      (a) => a.contentType && a.contentType.startsWith('text/csv')
    )
    const csvBase64 = csvAttachment
      ? Buffer.from(
          typeof csvAttachment.content === 'string'
            ? csvAttachment.content
            : csvAttachment.content
        ).toString('base64')
      : null

    const body = await getFormatedEmailBody(invoiceNumber, emailtemplate.body)
    const subject = await getFormatedSubject(
      invoiceNumber,
      emailtemplate.subject
    )

    return res.status(200).json({
      message: 'template fetch successful',
      data: {
        from: emailtemplate.from ?? '',
        to: emailtemplate.to ?? '',
        cc: emailtemplate.cc ?? '',
        subject,
        body,
        attachments: {
          csv: csvBase64
            ? {
                filename: csvAttachment.filename,
                mime: csvAttachment.contentType,
                base64: csvBase64,
              }
            : null,
          pdf: invoice.invoicePdfUrl
            ? {
                filename: `invoice_${invoice.invoiceNumber}.pdf`,
                mime: 'application/pdf',
                url: invoice.invoicePdfUrl,
              }
            : null,
        },
      },
    })
  } catch (error) {
    console.log('error raised at email part', error)
    return res.status(500).json({ message: 'Internal server issue' })
  }
}
