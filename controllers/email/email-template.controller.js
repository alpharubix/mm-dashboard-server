import { EMAIL_STATUS } from '../../conf/index.js'
import { EmailTemplate } from '../../models/email-template.model.js'
import {
  generateInvoiceAttachments,
  getFormatedEmailBody,
  getFormatedSubject,
  getInvoicesBasedOnEmailStatus,
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
    if (!distributorCode) {
      return res.status(400).json({ message: 'distributorCode is required' })
    }

    const emailtemplate = await getLenderTemplate(distributorCode)
    if (!emailtemplate) {
      return res
        .status(404)
        .json({ message: "No template found for this distributor's Lender" })
    }

    // 1. Fetch Invoices
    const invoices = await getInvoicesBasedOnEmailStatus(
      distributorCode,
      EMAIL_STATUS.ELIGIBLE
    )

    if (!invoices.length) {
      return res.status(404).json({ message: 'No eligible invoices found' })
    }

    // 2. Generate Attachments (Consolidated CSV & PDFs)
    const attachmentsArr = await generateInvoiceAttachments(
      invoices,
      emailtemplate.templateId
    )

    // 3. Generate Body
    // PASS THE FULL ARRAY HERE
    const body = await getFormatedEmailBody(invoices, emailtemplate.body)

    // 4. Generate Subject
    // const allInvoiceNumbers = invoices.map((i) => i.invoiceNumber).join(', ')
    const subject = await getFormatedSubject(invoices, emailtemplate.subject)

    // 4. Prepare Response
    const formattedAttachments = attachmentsArr.map((att) => ({
      filename: att.filename,
      mime: att.contentType,
      base64: Buffer.from(att.content).toString('base64'),
    }))

    return res.status(200).json({
      message: 'template fetch successful',
      data: {
        from: emailtemplate.from ?? '',
        to: emailtemplate.to ?? '',
        cc: emailtemplate.cc ?? '',
        subject,
        body,
        attachments: formattedAttachments,
      },
    })
  } catch (error) {
    console.log('error raised at email part', error)
    return res.status(500).json({ message: 'Internal server issue' })
  }
}
