import express from 'express'

import { outputUtrFtpController } from '../controllers/invoice-utr/fetch-from-ftp.js'
import { getAllOutputUtrData } from '../controllers/invoice-utr/get-all-utr-data.js'
import { getOutputUtrData } from '../controllers/invoice-utr/get-utr-data.js'
import { outputUtrCsvParseAndSave } from '../controllers/invoice-utr/upload-csv-to-db-and-ftp.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.get('/output-utr-ftp-data', outputUtrFtpController)
router.post(
  '/output-utr-upload',
  upload().single('csvfile'),
  outputUtrCsvParseAndSave
)
router.get('/output-utr', getOutputUtrData)
router.get('/output-utr-all', getAllOutputUtrData)

export default router
