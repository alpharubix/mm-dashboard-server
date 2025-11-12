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
    const { invoiceNumber, from, to, cc, subject, body, csv, pdfUrl } = req.body

    if (!invoiceNumber || !from || !to || !subject || !body) {
      return res.status(400).json({
        message: 'invoiceNumber, from, to, subject and body are required',
      })
    }

    // get invoice (optional guard)
    const invoice = await Invoice.findOne({ invoiceNumber }).lean()
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    // build attachments array for nodemailer
    const attachments = []

    // CSV (required) — expect csv = { filename, base64 }
    if (csv && csv.base64 && csv.filename) {
      const csvBuffer = Buffer.from(csv.base64, 'base64')
      attachments.push({
        filename: csv.filename,
        content: csvBuffer,
        contentType: csv.mime || 'text/csv',
      })
    } else {
      return res.status(400).json({ message: 'CSV attachment missing' })
    }

    // PDF — use URL from frontend (or invoice.invoicePdfUrl fallback)
    const pdfPath = pdfUrl || invoice.invoicePdfUrl
    if (pdfPath) {
      // Nodemailer supports `path` with an http(s) URL; it will fetch it.
      attachments.push({
        filename: `invoice_${invoiceNumber}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      })
    } else {
      return res.status(400).json({ message: 'PDF URL missing' })
    }

    const transporter = createSmtpConnection()
    if (!transporter)
      return res
        .status(500)
        .json({ message: 'Failed to create SMTP connection' })

    await constructAndSendMail(
      transporter,
      from,
      to,
      cc,
      subject,
      body,
      attachments
    )

    await updateInvoiceStatus(invoiceNumber, INV_STATUS.IN_PROGRESS, 'status')
    await updateInvoiceStatus(invoiceNumber, EMAIL_STATUS.SENT, 'emailStatus')

    return res.status(200).json({ message: 'email sent successfully' })
  } catch (err) {
    console.log('error raised at send mail:', err)
    return res.status(500).json({
      message: 'Internal server error',
      error: err.message,
    })
  }
}
