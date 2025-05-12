import express from 'express'
import upload from '../middlewares/multer.js'
import { outputUtrCsvParseAndSave, getOutputUtrData } from '../controllers/output-utr.controller.js'

const router = express.Router()

router.post('/output-utr-upload', upload().single('csvfile'), outputUtrCsvParseAndSave)
router.get('/output-utr', getOutputUtrData)

export default router
