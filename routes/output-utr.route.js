import express from 'express'
import {
  getAllOutputUtrData,
  getOutputUtrData,
  outputUtrCsvParseAndSave,
  outputUtrFtpController,
} from '../controllers/output-utr.controller.js'
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
