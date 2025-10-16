import nodemailer from 'nodemailer'
import { ENV } from '../../conf/index.js'
import { Distributor } from '../../models/distributor-list.model.js'
import { Invoice } from '../../models/invoice.model.js'
import { CreditLimit } from '../../models/credit-limit.model.js'

async function sendEmail(transporter, from, to, subject, text) {
  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    text: text,
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

export default async function EmailSend(req, res) {
  try {
    const { distCode, invoiceNumber } = req.body
    if (distCode && invoiceNumber) {
      //step-1 =>1 After getting distcode and invoiceNumber check weather the distcode is in whitlisted distcodes
      if (await isDistributorAllowed(distCode)) {
        //step-2=> If the distributor is whitelisted then fetch all the invoices where status is yet to be process
        const invoices = await getInvoices(distCode) //we believe that atleast one invoice will be there so it never return null

        //step-3=> check if the distributor have any overdued payments
        if (await isDistributorHasOverdue(distCode)) {
        } else {
          //if distributor has overdue update status of the fetched invoices from the step-2
          const updateResult = await updateInvoiceStatus(
            invoices,
            'pendingWithCustomer'
          )
          return res.status(403).json({
            message: `unable to send mail kindly check the overdue for this distributor - ${distCode} `,
          })
        }
      } else {
        return res
          .status(403)
          .json({ message: 'Distributor is not allowded for auto-emailing' })
      }
    } else {
      res.status(400).json({ message: 'distcode or invoiceNumber is missing' })
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
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to process the email', error: error.message })
  }
}

async function isDistributorAllowed(distCode) {
  const distributor = await Distributor.findOne({ distributorCode: distCode })
  if (distributor) {
    return true
  } else {
    return false
  }
}

async function getInvoices(distCode) {
  const invoices = await Invoice.find({
    distributorCode: distCode,
    status: 'yetToProcess',
  })
  console.log(invoices)
  return invoices
}

async function isDistributorHasOverdue(distCode) {
  const overdueAmount = await CreditLimit.findOne(
    { distributorCode: distCode },
    { overdue: 1 }
  )
  console.log(overdueAmount)
  if (!overdueAmount) {
    throw new Error(
      `CreditLimit record not found for distributor code: ${distCode}`
    )
  } else {
    if (overdueAmount.overdue == 0) {
      return true
    } else {
      return false
    }
  }
}
async function updateInvoiceStatus(invoices, statusToBeUpdated) {
  if (typeof invoices == 'string') {
    const updateResult = await Invoice.findOneAndUpdate(
      { invoiceNumber: invoices },
      { $set: { status: statusToBeUpdated } }
    )
    return updateResult
  }
  if (Array.isArray(invoices) && invoices.length > 0) {
    // Bulk update case
    const invoiceNumbers = invoices.map((i) => i.invoiceNumber)
    const result = await Invoice.updateMany(
      { invoiceNumber: { $in: invoiceNumbers } },
      { $set: { status: statusToBeUpdated } }
    )
    return result // returns { acknowledged: true, matchedCount, modifiedCount }
  }
}
