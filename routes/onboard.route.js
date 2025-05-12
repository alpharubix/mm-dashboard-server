import express from 'express'
import {
  getOnboardData,
  onboardCsvParseAndSave,
} from '../controllers/onboard.controller.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.post('/onboard-upload', upload().single('csvfile'), onboardCsvParseAndSave)
router.get('/onboard', getOnboardData)

export default router
