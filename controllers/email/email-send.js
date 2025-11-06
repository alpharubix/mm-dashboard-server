import converter from 'json-2-csv'
import juice from 'juice'
import nodemailer from 'nodemailer'
import { EMAIL_STATUS, ENV, INV_STATUS } from '../../conf/index.js'
import { Invoice } from '../../models/invoice.model.js'
import {
  getInvoices,
  isAvailableBalanceGreater,
  updateInvoiceStatus,
} from './utils/service.js'

async function _sendEmail(transporter, from, to, cc, subject, html) {
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
    // attachment: null
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
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: {
        user: 'techmgr@meramerchant.com',
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

export default async function sendEmail(req, res) {
  try {
    const { distCode, invoiceNumber, from, to, cc, subject, body } = req.body
    console.log({ distCode, invoiceNumber, from, to, cc, subject, body })
    if (!distCode || !invoiceNumber) {
      return res
        .status(400)
        .json({ message: 'Distributor code and Invoice number required' })
    }
    // if (distCode && invoiceNumber) {
    const invoices = await getInvoices(distCode) //there is a chance that it might return null as well
    console.log({ invoices })

    const isBalanceAvailable = await isAvailableBalanceGreater(
      invoices,
      distCode,
      invoiceNumber
    )
    if (isBalanceAvailable) {
      //send the mail and update both the status and email status of that particular invoice
      const transporter = createSmtpConnection()
      // const invoice = await Invoice.findOne({ invoiceNumber }).lean()
      // if (!invoice) throw new Error('Invoice not found')

      // 2. Remove unwanted fields
      // const { _id, __v, createdAt, updatedAt, ...filtered } = invoice

      // 3. Extract or transform needed data
      // const data = {
      //   date: Date.now(),
      //   distCode: filtered.distCode,
      //   invoiceNumber: filtered.invoiceNumber,
      //   amount: filtered.amount,
      //   customer: filtered.customerName,
      //   items: filtered.items?.length,
      // }
      console.log({ transporter })
      if (transporter) {
        await _sendEmail(transporter, from, to, cc, subject, body)
        return res.status(200).json({ msg: 'Sent successfully' })
      } else {
        return res.json({ msg: 'Not Sent' })
      }
      // return res.status(200).json({
      //   message: `Email sent successfully for this invoiceNumber-${invoiceNumber}`,
      // })
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
      return res.status(403).json({
        message: `unable to send mail kindly check the available-limit for the distributor - ${distCode}`,
      })
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to process the email', error: error.message })
  }
}
