import express from 'express'
import {
  getOutputLimitData,
  outputLimitCsvParseAndSave,
} from '../controllers/output-limit.controller.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.post('/output-limit-upload', upload().single('csvfile'), outputLimitCsvParseAndSave)
router.get('/output-limit', getOutputLimitData)

export default router
