import nodemailer from 'nodemailer'
import { ENV } from '../../conf/index.js'

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
  const { from, to, subject, body } = req.body
  const transporter = createSmtpConnection()
  console.log({ transporter })
  if (transporter) {
    await sendEmail(transporter, from, to, subject, body)
    return res.json({ msg: 'Sent successfully' })
  } else {
    return res.json({ msg: 'Not Sent' })
  }
}
