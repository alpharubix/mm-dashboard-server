import { Distributor } from '../../../models/distributor-list.model.js'
import { Invoice } from '../../../models/invoice.model.js'
import { CreditLimit } from '../../../models/credit-limit.model.js'

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
      $in: ['inProgress', 'pendingWithCustomer'],
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
  if (invoices.length != 0) {
    invoices.forEach((invoice) => {
      totalLoanAmount += invoice.loanAmount
    })
    const availableLimit = (
      await CreditLimit.findOne(
        { distributorCode: distCode },
        { availableLimit: 1 }
      )
    ).availableLimit
    console.log('Available limit=>', availableLimit)
    const invoiceLoanAmount = (
      await Invoice.findOne({ invoiceNumber: invoiceNumber }, { loanAmount: 1 })
    ).loanAmount
    console.log('InvoiceLoanAmount', invoiceLoanAmount)
    console.log('TotaLoanAmount=>', totalLoanAmount)
    let actualAvailableLimit = availableLimit - totalLoanAmount
    console.log('Actual available limit', actualAvailableLimit)
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
    console.log(invoiceLoanAmount, availableLimit)
    console.log(availableLimit >= invoiceLoanAmount)
    return availableLimit >= invoiceLoanAmount
  }
}
