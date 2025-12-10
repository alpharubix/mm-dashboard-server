import axios from 'axios'
import { format } from 'date-fns'
import converter from 'json-2-csv'
import { INV_STATUS } from '../../../conf/index.js'
import { CreditLimit } from '../../../models/credit-limit.model.js'
import { Distributor } from '../../../models/distributor-list.model.js'
import { EmailTemplate } from '../../../models/email-template.model.js'
import { Invoice } from '../../../models/invoice.model.js'
import { formatAmount } from '../../../utils/index.js'

export async function isDistributorAllowed(distCode) {
  const distributor = await Distributor.findOne({ distributorCode: distCode })
  if (distributor) {
    return true
  } else {
    return false
  }
}
export async function getInvoices(distCode) {
  const invoices = await Invoice.find({
    distributorCode: distCode,
    status: {
      $in: [INV_STATUS.IN_PROGRESS, INV_STATUS.PENDING_WITH_CUSTOMER],
    },
  })
  return invoices
}

export async function isDistributorHasOverdue(distCode) {
  const overdueAmount = await CreditLimit.findOne(
    { distributorCode: distCode },
    { overdue: 1 }
  )
  if (!overdueAmount) {
    throw new Error(
      `CreditLimit record not found for distributor code: ${distCode}`
    )
  } else {
    if (overdueAmount.overdue == 0) {
      return false
    } else {
      return true
    }
  }
}

export async function updateInvoiceStatus(
  invoices,
  statusToBeUpdated,
  fieldName
) {
  if (typeof invoices == 'string') {
    const updateResult = await Invoice.findOneAndUpdate(
      { invoiceNumber: invoices },
      { $set: { [fieldName]: statusToBeUpdated } }
    )
    return updateResult
  }
  if (Array.isArray(invoices) && invoices.length > 0) {
    // Bulk update case
    const invoiceNumbers = invoices.map((i) => i.invoiceNumber)
    const result = await Invoice.updateMany(
      { invoiceNumber: { $in: invoiceNumbers } },
      { $set: { [fieldName]: statusToBeUpdated } }
    )
    return result // returns { acknowledged: true, matchedCount, modifiedCount }
  }
}

export async function isAvailableBalanceGreater(
  invoices,
  distCode,
  invoiceNumber
) {
  let totalLoanAmount = 0
  if (invoices.length !== 0) {
    invoices.forEach((invoice) => {
      totalLoanAmount += invoice.loanAmount
    })
    const availableLimit = (
      await CreditLimit.findOne(
        { distributorCode: distCode },
        { availableLimit: 1 }
      )
    ).availableLimit
    // console.log('Available limit=>', availableLimit)
    const invoiceLoanAmount = (
      await Invoice.findOne({ invoiceNumber: invoiceNumber }, { loanAmount: 1 })
    ).loanAmount
    // console.log('InvoiceLoanAmount', invoiceLoanAmount)
    // console.log('TotaLoanAmount=>', totalLoanAmount)
    let actualAvailableLimit = availableLimit - totalLoanAmount
    // console.log('Actual available limit', actualAvailableLimit)
    return actualAvailableLimit >= invoiceLoanAmount
  } else {
    const invoiceLoanAmount = (
      await Invoice.findOne({ invoiceNumber: invoiceNumber }, { loanAmount: 1 })
    ).loanAmount
    const availableLimit = (
      await CreditLimit.findOne(
        { distributorCode: distCode },
        { availableLimit: 1 }
      )
    ).availableLimit
    // console.log(invoiceLoanAmount, availableLimit)
    // console.log(availableLimit >= invoiceLoanAmount)
    return availableLimit >= invoiceLoanAmount
  }
}

export async function getLenderTemplate(distributorCode) {
  const lenderName = (
    await Distributor.findOne(
      { distributorCode: distributorCode },
      { lender: 1 }
    )
  ).lender
  const template = await EmailTemplate.findOne({ templateId: lenderName })
  if (!template) {
    return null
  }
  return template
}

export async function getFormatedEmailBody(invoices, htmlTemplate) {
  if (!invoices || invoices.length === 0) return htmlTemplate

  const today = format(Date.now(), 'dd-MM-yyyy')
  const primaryInvoice = invoices[0]

  const rowRegex = /<tr[^>]*>(?:(?!<\/tr>).)*?{{invoiceNumber}}[\s\S]*?<\/tr>/s

  const match = htmlTemplate.match(rowRegex)
  let processedHtml = htmlTemplate

  if (match) {
    const templateRow = match[0]
    const allRowsHtml = invoices
      .map((inv) => {
        let row = templateRow

        row = row.replace(/{{distributorCode}}/g, inv.distributorCode || 'NA')
        row = row.replace(/{{invoiceNumber}}/g, inv.invoiceNumber || 'NA')

        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null
        row = row.replace(
          /{{invoiceDate}}/g,
          invDate ? format(invDate, 'dd-MM-yyyy') : 'NA'
        )

        row = row.replace(
          /{{loanAmount}}/g,
          formatAmount(inv.loanAmount) || '0'
        )

        return row
      })
      .join('')

    processedHtml = processedHtml.replace(templateRow, allRowsHtml)
  }

  const staticData = {
    '{{todayDate}}': today,
    '{{beneficiaryName}}': primaryInvoice.beneficiaryName || 'NA',
    '{{beneficiaryAccNo}}': primaryInvoice.beneficiaryAccNo || 'NA',
    '{{bankName}}': primaryInvoice.bankName || 'NA',
    '{{ifscCode}}': primaryInvoice.ifscCode || 'NA',
    '{{branch}}': primaryInvoice.branch || 'NA',
  }

  for (const [key, value] of Object.entries(staticData)) {
    const regex = new RegExp(key, 'g')
    processedHtml = processedHtml.replace(regex, value)
  }

  return processedHtml
}

export async function getFormatedSubject(invoices, subjectTemplate) {
  if (!invoices || invoices.length === 0) return subjectTemplate

  // 1. Calculate Total Amount
  const totalAmount = invoices.reduce((sum, inv) => {
    // Convert to number (remove commas if your string has them, or just use Number())
    const amount = Number(inv.loanAmount) || 0
    return sum + amount
  }, 0)

  // 2. Get Company Name
  const primary = invoices[0]
  // CRITICAL: Ensure your DB field is actually called 'companyName'.
  // If it's 'distributorName' in DB, change this line to: primary.distributorName
  const companyNameVal = primary.companyName || 'Distributor'

  let formattedSubject = subjectTemplate

  // 3. EXPLICIT REPLACEMENTS
  // This replaces {{companyName}} in the subject string
  formattedSubject = formattedSubject.replace(
    /{{companyName}}/g,
    companyNameVal
  )

  // This replaces {{loanAmount}} with the TOTAL calculated above
  formattedSubject = formattedSubject.replace(
    /{{loanAmount}}/g,
    formatAmount(totalAmount)
  )

  // Just in case you need invoice numbers
  const allInvoiceNumbers = invoices.map((i) => i.invoiceNumber).join(', ')
  formattedSubject = formattedSubject.replace(
    /{{invoiceNumber}}/g,
    allInvoiceNumbers
  )

  return formattedSubject
}

async function fetchFileFromUrl(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    console.log({ response })
    return Buffer.from(response.data)
  } catch (error) {
    console.log('Error fetching file from URL:', error)
    throw error
  }
}

export async function generateInvoiceAttachments(invoices) {
  const attachments = []
  const today = format(Date.now(), 'dd-MM-yyyy')
  try {
    // 1. Generate ONE Consolidated CSV
    // Map all invoices to the CSV format structure
    const csvRows = invoices.map((invoice) => ({
      Date: today,
      'Lender Name': 'Kotak Mahindra',
      'Distributor Name': invoice.companyName || 'NA',
      'Distributor Code': invoice.distributorCode || 'NA',
      'Contact Number': invoice.distributorPhone || 'NA',
      'Email ID': invoice.distributorEmail || 'NA',
      'Beneficiary Name': invoice.beneficiaryName || 'NA',
      'Beneficiary A/c no': invoice.beneficiaryAccNo
        ? `' ${invoice.beneficiaryAccNo}`
        : 'NA',
      'Bank Name': invoice.bankName || 'NA',
      'IFSC Code': invoice.ifscCode || 'NA',
      Branch: invoice.branch || 'NA',
      'Invoice no': invoice.invoiceNumber || 'NA',
      'Invoice amount': formatAmount(invoice.invoiceAmount) || 'NA',
      'Invoice date': format(invoice.invoiceDate, 'dd-MM-yyyy') || 'NA',
      'Loan Amount': formatAmount(invoice.loanAmount) || 'NA',
      'Loan Disbursement Date': today || 'NA',
      Tenure: '90 Days',
    }))

    const csvData = converter.json2csv(csvRows)

    attachments.push({
      filename: `consolidated_invoices_${today}.csv`, // Changed filename
      content: csvData,
      contentType: 'text/csv',
    })

    // 2. Fetch All PDFs Concurrently
    const pdfPromises = invoices
      .filter((inv) => inv.invoicePdfUrl) // Only process if URL exists
      .map(async (invoice) => {
        try {
          const pdfBuffer = await fetchFileFromUrl(invoice.invoicePdfUrl)
          return {
            filename: `invoice_${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }
        } catch (error) {
          console.error(
            `Error fetching PDF for ${invoice.invoiceNumber}:`,
            error
          )
          return null // Return null on failure to allow others to succeed
        }
      })

    const pdfAttachments = await Promise.all(pdfPromises)

    // Filter out any failed fetches (nulls) and add to main array
    attachments.push(...pdfAttachments.filter((item) => item !== null))
  } catch (error) {
    console.log('Error generating attachments:', error)
    throw error
  }

  return attachments
}
export async function getInvoicesBasedOnEmailStatus(distCode, status) {
  const invoices = await Invoice.find({
    distributorCode: distCode,
    emailStatus: {
      $in: status,
    },
  })
  return invoices
}
export async function getInvoicesBasedOnStatus(distCode, status) {
  const invoices = await Invoice.find({
    distributorCode: distCode,
    status: {
      $in: status,
    },
  })
  return invoices
}
export async function checkAvailableLimit(
  invoices,
  distCode,
  invoiceLoanAmount
) {
  let totalLoanAmount = 0
  if (invoices.length !== 0) {
    invoices.forEach((invoice) => {
      totalLoanAmount += invoice.loanAmount
    })
    const availableLimit = (
      await CreditLimit.findOne(
        { distributorCode: distCode },
        { availableLimit: 1 }
      )
    ).availableLimit
    // console.log('Available limit=>', availableLimit)
    // console.log('InvoiceLoanAmount', invoiceLoanAmount)
    // console.log('TotaLoanAmount=>', totalLoanAmount)
    let actualAvailableLimit = availableLimit - totalLoanAmount
    // console.log('Actual available limit', actualAvailableLimit)
    return actualAvailableLimit >= invoiceLoanAmount
  } else {
    const availableLimit = (
      await CreditLimit.findOne(
        { distributorCode: distCode },
        { availableLimit: 1 }
      )
    ).availableLimit
    // console.log(invoiceLoanAmount, availableLimit)
    // console.log(availableLimit >= invoiceLoanAmount)
    return availableLimit >= invoiceLoanAmount
  }
}
