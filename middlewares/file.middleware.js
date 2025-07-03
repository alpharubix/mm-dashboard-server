import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Multer config for csv upload data
export function uploadCsv() {
  try {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../inputfiles'))
      },
      filename: (req, file, cb) => {
        cb(null, file.originalname)
      },
    })
    const fileFilter = (req, file, cb) => {
      //only accepts csv files
      const ext = path.extname(file.originalname).toLowerCase()
      if (ext === '.csv') {
        cb(null, true)
      } else {
        cb(new Error('Only CSV files are allowed'), false)
      }
    }

    return multer({ storage, fileFilter })
  } catch (error) {
    res.status('')
  }
}

// Multer config for multipart form data
export function uploadPdf() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
      files: 200, // increased for high volume
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true)
      } else {
        cb(new Error('Only PDF files allowed'))
      }
    },
  })
}
