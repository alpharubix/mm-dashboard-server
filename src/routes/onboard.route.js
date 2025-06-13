import express from 'express'
import {
  getOnboardData,
  onboardCsvParseAndSave,
} from '../controllers/onboard.controller.js'
import { validateUser } from '../middlewares/auth.js'
import { isSuperAdmin } from '../middlewares/fileUploadBlocker.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.post(
  '/onboard-upload',
  validateUser,
  isSuperAdmin,
  upload().single('csvfile'),
  onboardCsvParseAndSave
)
router.get('/onboard', validateUser, getOnboardData)

export default router
