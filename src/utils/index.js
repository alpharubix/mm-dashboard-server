import { Client } from 'basic-ftp'
import path from 'path'
import { ENV } from '../conf/index.js'

export const toCamelCase = (str) => {
  const [first, ...rest] = str.trim().split(/\s+/)
  return (
    first.toLowerCase() +
    rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')
  )
}

export async function uploadFileToFtp(filePath) {
  const client = new Client()
  try {
    await client.access({
      host: ENV.FTP_HOST,
      user: ENV.FTP_USER,
      password: ENV.FTP_PASS,
      secure: false,
    })
    await client.uploadFrom(filePath, path.basename(filePath))
  } finally {
    try {
      await client.close()
    } catch (closeErr) {
      console.warn('Error closing FTP connection:', closeErr)
    }
  }
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

//
