import nodemailer from 'nodemailer'
import { ENV } from '../../conf/index.js'
import {
  getInvoices,
  updateInvoiceStatus,
  isAvailableBalanceGreater,
} from './utils/service.js'

// async function sendEmail(transporter, from, to, subject, text) {
//   const mailOptions = {
//     from: from,
//     to: to,
//     subject: subject,
//     text: text,
//   }

//   try {
//     const info = await transporter.sendMail(mailOptions)
//     console.log('Email sent:', info.messageId)
//     return info
//   } catch (error) {
//     console.log('Error sending email:', error)
//     throw error
//   }
// }

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
    const { distCode, invoiceNumber } = req.body
    if (distCode && invoiceNumber) {
      const invoices = await getInvoices(distCode) //there is a chance that it might return null as well

      const isBalanceAvailable = await isAvailableBalanceGreater(
        invoices,
        distCode,
        invoiceNumber
      )
      if (isBalanceAvailable) {
        //send the mail and update both the status and email status of that particular invoice
        return res.status(200).json({
          message: `Email sent successfully for this invoiceNumber-${invoiceNumber}`,
        })
      } else {
        //step 6 b=> if the available limit is lesser than the total amount dont send the mail update the invoice status
        //ad-hoc polymorphism single function behaves differently when called with different parameters
        await updateInvoiceStatus(
          invoiceNumber,
          'pendingWithCustomer',
          'status'
        )
        await updateInvoiceStatus(
          invoiceNumber,
          'insufficientAvailableLimit',
          'emailStatus'
        )
        return res.status(403).json({
          message: `unable to send mail kindly check the available-limit for the distributor - ${distCode}`,
        })
      }
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to process the email', error: error.message })
  }
  // const { from, to, subject, body } = req.body
  // const transporter = createSmtpConnection()
  // console.log({ transporter })
  // if (transporter) {
  //   await sendEmail(transporter, from, to, subject, body)
  //   return res.json({ msg: 'Sent successfully' })
  // } else {
  //   return res.json({ msg: 'Not Sent' })
  // }
}
