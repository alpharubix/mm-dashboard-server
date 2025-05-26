import express from 'express'
import { validateUser} from '../middlewares/auth.js'
import { isAllowded } from '../middlewares/fileUploadBlocker.js'
import {
  getOnboardData,
  onboardCsvParseAndSave,
} from '../controllers/onboard.controller.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.post('/onboard-upload',validateUser,isAllowded,upload().single('csvfile'), onboardCsvParseAndSave)
router.get('/onboard',validateUser,getOnboardData)

export default router
