import ftp from 'basic-ftp'
import csvParser from 'csv-parser'
import fs from 'fs'
import { Input } from '../models/input.model.js'
import { toCamelCase } from '../utils/index.js'

export async function inputFtpController(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'beneficiaryName',
    'beneficiaryAccountNo',
    'bankName',
    'ifscCode',
    'branch',
    'invoiceNum',
    'invoiceAmount',
    'invoiceDate',
    'loanAmountExclCreditBalance',
  ]

  const client = new ftp.Client()
  const tempFile = 'input-temp.csv'
  const rows = []

  try {
    await client.access({
      host: 'ftp.dummyserver.com',
      user: 'dummyUser',
      password: 'dummyPass',
      secure: false,
    })

    await client.downloadTo(tempFile, '/dummy/path/input-data.csv')
    client.close()

    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFile)
        .pipe(csvParser({ mapHeaders: ({ header }) => toCamelCase(header) }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject)
    })

    if (!rows.length) {
      return res.status(400).json({ message: 'CSV is empty' })
    }

    const csvFields = Object.keys(rows[0])
    const missing = requiredFields.filter((f) => !csvFields.includes(f))
    const extra = csvFields.filter((f) => !requiredFields.includes(f))
    if (missing.length || extra.length) {
      return res.status(400).json({
        message: 'CSV header mismatch',
        missingFields: missing,
        extraFields: extra,
      })
    }

    const toInsert = rows.map((r) => ({
      ...r,
      invoiceAmount: Number(r.invoiceAmount),
      loanAmountExclCreditBalance: Number(r.loanAmountExclCreditBalance),
      invoiceDate: new Date(r.invoiceDate),
    }))

    const docs = await Input.insertMany(toInsert)

    res.json({
      message: 'FTP CSV parsed and saved to Input collection',
      insertedCount: docs.length,
    })
  } catch (err) {
    console.error('FTP/Input CSV error:', err)
    res
      .status(500)
      .json({ message: 'Internal server error', error: err.message })
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    client.close()
  }
}

export const getInputData = async (req, res) => {
  try {
    const data = await Input.find()
    res.status(200).json({ message: 'Fetched input data successfully', data })
  } catch (error) {
    console.error('Error fetching input data:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
