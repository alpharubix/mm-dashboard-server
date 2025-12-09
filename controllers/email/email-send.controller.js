import juice from 'juice'
import nodemailer from 'nodemailer'
import { EMAIL_STATUS, ENV, INV_STATUS } from '../../conf/index.js'
import { Invoice } from '../../models/invoice.model.js'
import {
  getInvoices,
  isAvailableBalanceGreater,
  updateInvoiceStatus,
} from './email-service/service.js'

async function constructAndSendMail(
  transporter,
  from,
  to,
  cc,
  subject,
  html,
  attachments
) {
  const inlinedHtml = juice(`
    <style>
      table, th, td {
        border: 1px solid #000;
        border-collapse: collapse;
      }
      th, td {
        padding: 2px;
        text-align: center;
      }
    </style>
    ${html}
  `)
  const mailOptions = {
    from: from,
    to: to,
    cc: cc,
    subject: subject,
    html: inlinedHtml,
    attachments: attachments,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent:', info.messageId)
    return info
  } catch (error) {
    console.log('Error sending email:', error)
    throw error
  }
}

function createSmtpConnection() {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtppro.zoho.in',
      port: 465,
      secure: true, // SSL mode
      auth: {
        user: 'invoice@r1xchange.com',
        pass: ENV.ZOHO_APP_PASSWORD,
      },
    })
    console.log('SMTP connection created successfully.')
    return transporter
  } catch (error) {
    console.log('Error creating SMTP connection:', error)
    return null
  }
}

export async function checkEmailEligibility(req, res) {
  try {
    const { distributorCode, invoiceNumber, from, to, cc, subject, body } =
      req.body
    console.log({ distributorCode, invoiceNumber, from, to, cc, subject, body })
    if (!distributorCode || !invoiceNumber) {
      return res
        .status(400)
        .json({ message: 'Distributor code and Invoice number required' })
    }
    // if (distributorCode && invoiceNumber) {
    const invoices = await getInvoices(distributorCode) //there is a chance that it might return null as well
    console.log({ invoices })

    const isBalanceAvailable = await isAvailableBalanceGreater(
      invoices,
      distributorCode,
      invoiceNumber
    )
    if (isBalanceAvailable) {
      return res
        .status(200)
        .json({ message: 'Invoice is ready for sending', isEligible: true })
    } else {
      //step 6 b=> if the available limit is lesser than the total amount dont send the mail update the invoice status
      //ad-hoc polymorphism single function behaves differently when called with different parameters
      await updateInvoiceStatus(
        invoiceNumber,
        INV_STATUS.PENDING_WITH_CUSTOMER,
        'status'
      )
      await updateInvoiceStatus(
        invoiceNumber,
        EMAIL_STATUS.INSUFF_AVAIL_LIMIT,
        'emailStatus'
      )
      return res.status(400).json({
        message: `Unable to send mail kindly check the Available Limit for the distributor - ${distributorCode}`,
        isEligible: false,
      })
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to process the email', error: error.message })
  }
}

export async function sendmail(req, res) {
  try {
    // 1. Accept 'attachments' array instead of specific csv/pdfUrl fields
    const { invoiceNumbers, from, to, cc, subject, body, attachments } =
      req.body
    console.log({ invoiceNumbers })
    if (!invoiceNumbers.length === 0 || !from || !to || !subject || !body) {
      return res.status(400).json({
        message: 'invoiceNumber, from, to, subject and body are required',
      })
    }

    // 2. Handle Multiple Invoice Numbers
    const invoices = await Invoice.find({
      invoiceNumber: { $in: invoiceNumbers },
    }).lean()
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ message: 'No invoices found' })
    }

    // 3. Prepare Attachments
    // The frontend sends the array exactly how Nodemailer wants it
    // (with 'content', 'encoding', 'filename'), so we just use it directly.
    // If your frontend sends { mime, base64 }, you might need a quick map here.
    // Assuming your Frontend logic from previous steps:
    const mailAttachments = attachments.map((att) => ({
      filename: att.filename,
      // If frontend sends 'content' (base64 string) and 'encoding', use that.
      // If frontend sends 'base64' key (from your earlier code), map it:
      content: att.content || att.base64,
      encoding: 'base64',
      contentType: att.contentType || att.mime,
    }))

    const transporter = createSmtpConnection()
    if (!transporter)
      return res
        .status(500)
        .json({ message: 'Failed to create SMTP connection' })

    // 4. Send Mail
    await constructAndSendMail(
      transporter,
      from,
      to,
      cc,
      subject,
      body,
      mailAttachments // Pass the array of attachments
    )

    // 5. Update Status for ALL Invoices
    // We loop through the array of numbers we split earlier
    await Promise.all(
      invoiceNumbers.map(async (invNum) => {
        await updateInvoiceStatus(invNum, INV_STATUS.IN_PROGRESS, 'status')
        await updateInvoiceStatus(invNum, EMAIL_STATUS.SENT, 'emailStatus')
      })
    )

    return res.status(200).json({ message: 'email sent successfully' })
  } catch (err) {
    console.log('error raised at send mail:', err)
    return res.status(500).json({
      message: 'Internal server error',
      error: err.message,
    })
  }
}
