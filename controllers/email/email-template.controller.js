import { EmailTemplate } from '../../models/email-template.model.js'
import {
  getLenderTemplate,
  getFormatedEmailBody,
  getFormatedSubject,
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
    const distcode = req.query.distcode
    const invoiceNumber = req.query.invoiceNumber
    if (!distcode || !invoiceNumber) {
      return res
        .status(400)
        .json({ message: 'Both distcode and invoiceNumber is required' })
    }
    const emailtemplate = await getLenderTemplate(distcode)
    if (!emailtemplate) {
      return res
        .status(204)
        .json({ message: "No template found for this distributor's Lender" })
    }
    const body = await getFormatedEmailBody(invoiceNumber, emailtemplate.body)
    const subject = await getFormatedSubject(
      invoiceNumber,
      emailtemplate.subject
    )
    return res.status(200).json({
      message: 'template fetch successfull',
      data: {
        from: emailtemplate.from,
        to: emailtemplate.to,
        cc: emailtemplate.cc,
        subject: subject,
        body: body,
      },
    })
  } catch (error) {
    console.log('error raised at email part')
    return res.status(500).json({ message: 'Internal server issue' })
  }
}
