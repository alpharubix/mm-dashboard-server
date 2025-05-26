import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { uploadPDF } from './gcs.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const inputFilesDir = path.join(__dirname, '..', 'inputfiles')

export async function runBatchUpload() {
  console.log(`Scanning for PDFs in: ${inputFilesDir}`)

  try {
    const files = await fs.readdir(inputFilesDir)
    const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'))

    if (pdfFiles.length === 0) {
      console.log('No PDF files found in the inputfiles folder.')
      return
    }

    console.log(`Found ${pdfFiles.length} PDF(s) to upload.`)

    for (const fileName of pdfFiles) {
      const localPdfPath = path.join(inputFilesDir, fileName)
      const destinationFileName = fileName

      console.log(`\n--- Starting upload for: ${fileName} ---`)
      try {
        const publicDownloadUrl = await uploadPDF(
          localPdfPath,
          destinationFileName
        )
        console.log(`--- Finished upload for: ${fileName} ---`)
        console.log('Public Download URL:', publicDownloadUrl)
      } catch (uploadError) {
        console.error(`--- Failed to upload ${fileName}:`, uploadError.message)
      }
    }

    console.log('\n--- Batch upload process completed ---')
  } catch (readDirError) {
    console.error(
      `\nError reading directory ${inputFilesDir}:`,
      readDirError.message
    )
    console.error(
      'Please ensure the `inputfiles` folder exists and is accessible.'
    )
  }
}
