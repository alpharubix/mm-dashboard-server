import ftp from 'basic-ftp'
import csvParser from 'csv-parser'
import { parse } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ENV } from '../conf/index.js'
import { Input } from '../models/input.model.js'
import { toCamelCase } from '../utils/index.js'
import { runBatchUpload } from '../utils/upload.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cleanNumber = (val) => {
  if (!val) return NaN
  return Number(String(val).replace(/,/g, '').trim())
}

export async function inputFtpController(req, res) {
  const requiredFields = [
    'companyName',
    'distributorCode',
    'beneficiaryName',
    'beneficiaryAccNo',
    'bankName',
    'ifscCode',
    'branch',
    'invoiceNumber',
    'invoiceAmount',
    'invoiceDate',
    'loanAmount',
  ]

  const client = new ftp.Client()
  const inputDir = path.join(__dirname, '../inputfiles')
  const localFile = path.join(inputDir, 'input.csv')
  const rows = []
  let insertedDocs

  try {
    if (!fs.existsSync(inputDir)) {
      fs.mkdirSync(inputDir)
    }

    await client.access({
      host: ENV.FTP_HOST,
      user: ENV.FTP_USER,
      password: ENV.FTP_PASS,
      secure: false,
    })

    const fileList = await client.list()
    const fileExists = fileList.some((file) => file.name === 'input.csv')
    if (!fileExists) {
      return res
        .status(404)
        .json({ message: 'input.csv not found on FTP server' })
    }

    console.log('Downloading input.csv...')
    await client.downloadTo(localFile, 'input.csv')
    console.log('Download complete.')

    // 3) Parse the CSV file
    console.log('Parsing CSV...')
    await new Promise((resolve, reject) => {
      fs.createReadStream(localFile)
        .pipe(csvParser({ mapHeaders: ({ header }) => toCamelCase(header) }))
        .on('data', (row) => rows.push(row))
        .on('end', () => {
          console.log('CSV parsing complete. Rows:', rows.length)
          resolve()
        })
        .on('error', reject)
    })

    if (!rows.length) {
      return res.status(400).json({ message: 'CSV is empty' })
    }

    // 4) Validate CSV headers
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

    const invoiceNumbers = rows.map((r) => r.invoiceNumber)
    const duplicatesInCSV = invoiceNumbers.filter(
      (item, index) => invoiceNumbers.indexOf(item) !== index
    )
    if (duplicatesInCSV.length) {
      return res.status(400).json({
        message: 'Duplicate invoiceNumbers found within the CSV',
        duplicates: [...new Set(duplicatesInCSV)],
      })
    }
    console.log('CSV internal duplicates check passed.')

    console.log('Checking for existing invoices in DB...')
    const existingDocsInDb = await Input.find({
      invoiceNumber: { $in: invoiceNumbers },
    }).select('invoiceNumber')

    const existingInvoiceNumbersSet = new Set(
      existingDocsInDb.map((doc) => doc.invoiceNumber)
    )
    console.log(
      `Found ${existingInvoiceNumbersSet.size} existing invoices in DB from CSV.`
    )

    // 7) Filter rows: separate new/valid ones from existing/invalid ones
    const toInsert = []
    const duplicatesInDb = []
    const invalidRows = []

    for (const row of rows) {
      if (existingInvoiceNumbersSet.has(row.invoiceNumber)) {
        // This invoice number is already in the DB
        duplicatesInDb.push(row.invoiceNumber)
      } else {
        // This is a new invoice number, prepare it for insertion
        try {
          // Clean and parse data types
          const invoiceAmount = cleanNumber(row.invoiceAmount)
          const loanAmount = cleanNumber(row.loanAmount)
          // Ensure parse result is valid
          const invoiceDate = parse(row.invoiceDate, 'dd-MM-yyyy', new Date())

          // Check for invalid data types *after* cleaning/parsing
          if (
            isNaN(invoiceAmount) ||
            isNaN(loanAmount) ||
            isNaN(invoiceDate.getTime())
          ) {
            // Collect invalid rows instead of throwing immediately
            invalidRows.push({
              invoiceNumber: row.invoiceNumber,
              error: 'Invalid data types (amount or date)',
              originalRow: row,
            })
            continue
          }

          const pdfName = `${row.invoiceNumber}.pdf`
          const localPdfPath = path.join(inputDir, pdfName)
          let invoicePdfUrl = null

          if (fileList.some((file) => file.name === pdfName)) {
            try {
              await client.downloadTo(localPdfPath, pdfName)
            } catch (e) {
              console.error(`PDF download failed for ${pdfName}:`, e.message)
            }
          }

          toInsert.push({
            ...row,
            invoiceAmount,
            loanAmount,
            invoiceDate,
            invoicePdfUrl,
          })
        } catch (parseError) {
          // Catch potential errors during parse/clean if not handled by isNaN
          invalidRows.push({
            invoiceNumber: row.invoiceNumber,
            error: parseError.message || 'Parsing error',
            originalRow: row,
          })
          continue
        }
      }
    }

    // ADDED: Batch GCS upload and URL mapping logic
    let gcsUploadSummary = {
      message: 'GCS upload not attempted.',
      uploaded: [],
      failed: [],
    }
    try {
      gcsUploadSummary = await runBatchUpload()
    } catch (gcsBatchError) {
      console.error(
        'Critical error during GCS batch upload:',
        gcsBatchError.message
      )
      gcsUploadSummary.message = `GCS batch upload failed: ${gcsBatchError.message}`
      gcsUploadSummary.error = gcsBatchError.message
    }

    const uploadedPdfMap = new Map()
    gcsUploadSummary?.uploaded?.forEach((item) =>
      uploadedPdfMap.set(item.fileName, item.url)
    )
    gcsUploadSummary?.failed?.forEach((item) =>
      uploadedPdfMap.set(item.fileName, `UPLOAD_FAILED: ${item.error}`)
    )

    for (const doc of toInsert) {
      const pdfFileName = `${doc.invoiceNumber}.pdf`
      doc.invoicePdfUrl = `https://storage.googleapis.com/${ENV.BUCKET_NAME}/${pdfFileName}`
    }
    if (toInsert.length === 0) {
      const allDbDuplicates = duplicatesInDb.length === rows.length
      const allInvalid = invalidRows.length === rows.length

      if (allDbDuplicates) {
        return res.status(200).json({
          message:
            'All invoice numbers already exist in the database. No new data.',
          insertedCount: 0,
        })
      }

      if (allInvalid) {
        return res.status(400).json({
          message: 'All rows have invalid data.',
          skippedInvalidRows: invalidRows.map((r) => ({
            invoiceNumber: r.invoiceNumber,
            error: r.error,
          })),
        })
      }

      return res.status(400).json({
        message: 'No valid or new invoices found in the CSV to insert.',
        skippedDuplicates: duplicatesInDb,
        skippedInvalidRows: invalidRows.map((r) => ({
          invoiceNumber: r.invoiceNumber,
          error: r.error,
        })),
      })
    }

    // 9) Insert into Mongo - ONLY the ones not found in the DB and are valid
    console.log(`Attempting to insert ${toInsert.length} new invoices...`)
    if (toInsert.length > 0) {
      insertedDocs = await Input.insertMany(toInsert, { ordered: false })
      console.log(
        `Successfully inserted ${insertedDocs.length} documents into Input collection.`
      )
      // Prepare data for OutputUTR (excluding loanDisbursementDate, utr, status as they're not from CSV initially)
      // const utrDocsToInsert = insertedDocs.map((doc) => {
      //   const { invoicePdfUrl, _id, __v, ...rest } = doc.toObject()
      //   return {
      //     ...rest,
      //   }
      // })

      // await OutputUTR.insertMany(utrDocsToInsert, { ordered: false })
      // console.log(
      //   `Successfully inserted ${utrDocsToInsert.length} documents into OutputUTR collection.`
      // )
    } else {
      insertedDocs = []
      console.log('No new documents to insert.')
    }

    // 10) Construct and send the response
    const responseMessageParts = []
    if (insertedDocs.length > 0) {
      responseMessageParts.push(
        `Successfully inserted ${insertedDocs.length} new invoices.`
      )
    }
    if (duplicatesInDb.length > 0) {
      responseMessageParts.push(
        `Skipped ${duplicatesInDb.length} invoices that already exist in the database.`
      )
    }
    if (invalidRows.length > 0) {
      responseMessageParts.push(
        `Skipped ${invalidRows.length} rows due to invalid data.`
      )
    }

    res.status(200).json({
      message: responseMessageParts.join(' ') || 'No data processed.',
      insertedCount: insertedDocs.length,
      skippedDuplicates: duplicatesInDb,
      skippedInvalidRows: invalidRows.map((r) => ({
        invoiceNumber: r.invoiceNumber,
        error: r.error,
      })),
      insertedDocsDetails: insertedDocs.map((doc) => ({
        invoiceNumber: doc.invoiceNumber,
        invoicePdfUrl: doc.invoicePdfUrl,
      })),
      gcsUploadSummary: gcsUploadSummary,
    })
  } catch (err) {
    console.error('FTP/Input CSV processing error:', err)

    let userFacingMessage = 'Internal server error processing the file.'
    if (err.message.includes('Invalid data types')) {
      userFacingMessage = err.message
    } else if (err.message) {
      userFacingMessage = `Processing failed: ${err.message}`
    }

    res.status(500).json({
      message: userFacingMessage,
      error: err.message || err,
    })
  } finally {
    // 11) Clean up local file and close FTP connection
    if (fs.existsSync(localFile)) {
      console.log(`Deleting local file: ${localFile}`)
      fs.unlink(localFile, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting input.csv:', unlinkErr)
        else console.log('Local file deleted.')
      })
    }
    if (client) {
      console.log('Closing FTP connection...')
      client.close()
      console.log('FTP connection closed.')
    }
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
