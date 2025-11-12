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
