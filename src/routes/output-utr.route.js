import express from 'express'

import { outputUtrFtpController } from '../controllers/invoice-utr/fetch-from-ftp.controller.js'
import { getAllOutputUtrData } from '../controllers/invoice-utr/get-all-utr-data.controller.js'
import { getOutputUtrData } from '../controllers/invoice-utr/get-utr-data.controller.js'
import { outputUtrCsvParseAndSave } from '../controllers/invoice-utr/upload-csv-to-db-and-ftp.controller.js'
import { validateUser } from '../middlewares/auth.js'
import { isSuperAdmin } from '../middlewares/fileUploadBlocker.js'
import upload from '../middlewares/multer.js'
import { invoiceInput } from '../controllers/invoice-utr/invoice-input.controller.js'

const router = express.Router()

// router.get('/output-utr-ftp-data', validateUser, outputUtrFtpController)

// POST json - anchor
router.post('/invoice-input', validateUser, invoiceInput)

// POST pdf - anchor
router.post('/invoice-pdf', validateUser)

// POST csv - MM
router.post(
  '/invoice-utr-upload',
  validateUser,
  isSuperAdmin,
  upload().single('csvfile'),
  outputUtrCsvParseAndSave
)

// GET json - MM & anchor
router.get('/invoice-input', validateUser, getOutputUtrData)
// router.get('/output-utr-all', validateUser, getAllOutputUtrData)

export default router
