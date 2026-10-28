export const toCamelCase = (str) => {
  const [first, ...rest] = str.trim().split(/\s+/)
  return (
    first.toLowerCase() +
    rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')
  )
}

export const cleanNumber = (val) => {
  if (!val) return NaN
  return Number(String(val).replace(/,/g, '').trim())
}

export function getUserName(companyName) {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove special chars
    .replace(/\s+/g, '-') // spaces to hyphens
    .trim()
}

export function generateCompanyPassword(companyName) {
  const short = companyName
    .toLowerCase()
    .replace(/[^a-z]/g, '') // remove non-letters
    .slice(0, 10) // keep it readable, max 10 chars

  const randomLetters = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return (
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)]
    )
  }

  const randomDigits = () => Math.floor(10 + Math.random() * 90) // 10–99

  return `${short}${randomLetters()}${randomDigits()}`
}

export function calculateBillingStatus(currentAvailable, overdue) {
  if (currentAvailable < 0 || overdue > 0) {
    return 'negative'
  }
  return 'positive'
}

export const isValidPhone = (str) => /^\d{10}$/.test(str)

export const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '0.00'
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Map of Anchor ID -> Lender Name (normalized lower case) -> Payment Due Days
export const LENDER_ANCHOR_AGEING_DAYS = {
  hwc: {
    kotak: 90,
    'kotak mahindra': 90,
    tyger: 60,
    'tyger capital': 60,
    muthoot: 45,
    hero: 90,
  },
  ckpl: {
    kotak: 60,
    'kotak mahindra': 60,
    tyger: 30,
    'tyger capital': 30,
    muthoot: 45,
    hero: 60,
  },
}

export function getPaymentDueDays(lenderName, anchorId) {
  if (!lenderName) return null
  const normalizedLender = lenderName.toString().trim().toLowerCase()
  const normalizedAnchor = (anchorId || '').toString().trim().toLowerCase()

  const anchorMap = LENDER_ANCHOR_AGEING_DAYS[normalizedAnchor] || LENDER_ANCHOR_AGEING_DAYS.default
  return anchorMap[normalizedLender] ?? LENDER_ANCHOR_AGEING_DAYS.default[normalizedLender] ?? null
}

export function computeInvoiceAgeing(invoice) {
  const inv = typeof invoice.toObject === 'function' ? invoice.toObject() : { ...invoice }

  let paymentDueDays = inv.paymentDueDays
  if (paymentDueDays === null || paymentDueDays === undefined) {
    paymentDueDays = getPaymentDueDays(inv.lenderName, inv.anchorId)
  }

  let paymentDueDate = inv.paymentDueDate
  if (inv.loanDisbursementDate && paymentDueDays) {
    const ldd = new Date(inv.loanDisbursementDate)
    if (!isNaN(ldd.getTime())) {
      const d = new Date(ldd)
      d.setDate(d.getDate() + Number(paymentDueDays))
      paymentDueDate = d
    }
  }

  let currentAgeingDays = inv.currentAgeingDays
  if (inv.loanDisbursementDate) {
    const ldd = new Date(inv.loanDisbursementDate)
    if (!isNaN(ldd.getTime())) {
      const isPaid = (inv.invoicePaymentStatus || '').toString().trim().toLowerCase() === 'paid'
      const endDate = isPaid && inv.paymentReceivedDate ? new Date(inv.paymentReceivedDate) : new Date()

      // Calculate whole calendar days difference
      const diffTime = endDate.getTime() - ldd.getTime()
      currentAgeingDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
    }
  }

  return {
    ...inv,
    paymentDueDays: paymentDueDays ?? null,
    paymentDueDate: paymentDueDate ?? null,
    currentAgeingDays: currentAgeingDays ?? null,
  }
}

