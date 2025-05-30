import csvParser from 'csv-parser'
import fs from 'fs'
import ftp from 'ftp'
import path from 'path'
import { ENV } from '../conf/index.js'
import { toCamelCase } from './index.js'

export async function fetchAndParseCsvFromFtp(
  fileName,
  localDirPath,
  requiredFields
) {
  const client = new ftp.Client()
  const localFilePath = path.join(localDirPath, fileName)
  const rows = []

  try {
    if (!fs.existsSync(localDirPath)) {
      fs.mkdirSync(localDirPath)
    }

    await client.access({
      host: ENV.FTP_HOST,
      user: ENV.FTP_USER,
      password: ENV.FTP_PASS,
      secure: false,
    })

    const fileList = await client.list()
    const fileExists = fileList.some((file) => file.name === fileName)
    if (!fileExists) {
      throw new Error(`${fileName} not found on FTP server`)
    }

    await client.downloadTo(localFilePath, fileName)

    await new Promise((resolve, reject) => {
      fs.createReadStream(localFilePath)
        .pipe(csvParser({ mapHeaders: ({ header }) => toCamelCase(header) }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject)
    })

    if (!rows.length) {
      throw new Error('CSV is empty')
    }

    const csvFields = Object.keys(rows[0])
    const missing = requiredFields.filter((f) => !csvFields.includes(f))
    const extra = csvFields.filter((f) => !requiredFields.includes(f))
    if (missing.length || extra.length) {
      throw new Error('CSV header mismatch', {
        cause: { missingFields: missing, extraFields: extra },
      })
    }

    return rows
  } finally {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath)
    }
    if (client) {
      client.close()
    }
  }
}
