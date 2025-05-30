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
