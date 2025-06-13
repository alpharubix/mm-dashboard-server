import express from 'express'
import {
  getOutputLimitData,
  outputLimitCsvParseAndSave,
} from '../controllers/output-limit.controller.js'
import { validateUser } from '../middlewares/auth.js'
import { isSuperAdmin } from '../middlewares/fileUploadBlocker.js'
import upload from '../middlewares/multer.js'

const router = express.Router()

router.post(
  '/credit-limit-upload',
  validateUser,
  isSuperAdmin,
  upload().single('csvfile'),
  outputLimitCsvParseAndSave
)
router.get('/credit-limit', validateUser, getOutputLimitData)

export default router
