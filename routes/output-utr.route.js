import express from 'express'

import { getOutputUtrData } from '../controllers/invoice-utr/get-utr-data.controller.js'
import { outputUtrCsvParseAndSave } from '../controllers/invoice-utr/upload-csv-to-db.controller.js'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { invoiceInput } from '../controllers/invoice-utr/invoice-input.controller.js'
import { invoicePdf } from '../controllers/invoice-utr/invoice-pdf.controller.js'
import { csvUpload, uploadPdf } from '../middlewares/file.middleware.js'

const router = express.Router()

// POST json - anchor
router.post('/invoice-input', validateUser, invoiceInput)

// POST pdf - anchor
router.post('/invoice-pdf', validateUser, uploadPdf().array('pdfs'), invoicePdf)

// POST csv - MM
router.post(
  '/invoice-utr-upload',
  validateUser,
  isSuperAdmin,
  csvUpload().single('csvfile'),
  outputUtrCsvParseAndSave
)

// GET json - MM & anchor
router.get('/invoice-input', validateUser, getOutputUtrData)

export default router
