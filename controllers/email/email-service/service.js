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
  //No need to check lenderName cause we will only get invoices once distributor is onboarded so it never be undefied or null
  const template = await EmailTemplate.findOne({ templateId: lenderName })
  if (!template) {
    return null
  }
  return template
}

export async function getFormatedEmailBody(invoiceNumber, body) {
  console.log({ invoiceNumber }, { body })
  const doc = await Invoice.findOne(
    { invoiceNumber: invoiceNumber },
    {
      distributorCode: 1,
      invoiceNumber: 1,
      invoiceDate: 1,
      loanAmount: 1,
      beneficiaryName: 1,
      beneficiaryAccNo: 1,
      bankName: 1,
      ifscCode: 1,
      branch: 1,
      _id: 0,
    }
  )
  const placeholders = doc.toObject()
  placeholders.todayDate = format(Date.now(), 'dd-MM-yyyy')

  placeholders.invoiceDate = format(doc.invoiceDate, 'dd-MM-yyyy')

  const filledBody = body.replace(/{{(.*?)}}/g, (match, key) => {
    const trimmedKey = key.trim()
    return placeholders[trimmedKey] || ''
  })
  return filledBody
}

export async function getFormatedSubject(invoiceNumber, subject) {
  const placeholders = (
    await Invoice.findOne(
      { invoiceNumber: invoiceNumber },
      { companyName: 1, loanAmount: 1, _id: 0 }
    )
  ).toObject()
  const filledSubject = subject.replace(/{{(.*?)}}/g, (match, key) => {
    const trimmedKey = key.trim()
    return placeholders[trimmedKey] || ''
  })
  return filledSubject
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

export async function generateInvoiceAttachments(invoice) {
  const attachments = []
  const today = format(Date.now(), 'dd-MM-yyyy')
  try {
    // Generate CSV from invoice fields
    const csvData = converter.json2csv([
      {
        Date: today,
        'Lender Name': 'Kotak Mahindra',
        'Distributor Name': invoice.companyName || 'NA',
        'Distributor Code': invoice.distributorCode || 'NA',
        'Contact Number': invoice.distributorPhone || 'NA',
        'Email ID': invoice.distributorEmail || 'NA',
        'Beneficiary Name': invoice.beneficiaryName || 'NA',
        'Beneficiary A/c no': invoice.beneficiaryAccNo || 'NA',
        'Bank Name': invoice.bankName || 'NA',
        'IFSC Code': invoice.ifscCode || 'NA',
        Branch: invoice.branch || 'NA',
        'Invoice no': invoice.invoiceNumber || 'NA',
        'Invoice amount': formatAmount(invoice.invoiceAmount) || 'NA',
        'Invoice date': format(invoice.invoiceDate, 'dd-MM-yyyy') || 'NA',
        'Loan Amount': formatAmount(invoice.loanAmount) || 'NA',
        'Loan Disbursement Date': today || 'NA',
        Tenure: '90 Days',
      },
    ])

    attachments.push({
      filename: `invoice_${invoice.invoiceNumber}.csv`,
      content: csvData,
      contentType: 'text/csv',
    })
  } catch (error) {
    console.log('Error generating CSV:', error)
    throw error
  }

  // Fetch and attach PDF from GCS
  if (invoice.invoicePdfUrl) {
    try {
      const pdfBuffer = await fetchFileFromUrl(invoice.invoicePdfUrl)
      attachments.push({
        filename: `invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      })
    } catch (error) {
      console.log('Error fetching PDF:', error)
      throw error
    }
  }

  return attachments
}
