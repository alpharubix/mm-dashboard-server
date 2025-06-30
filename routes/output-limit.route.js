import express from 'express'
import {
  getOutputLimitData,
  outputLimitCsvParseAndSave,
} from '../controllers/output-limit.controller.js'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { csvUpload } from '../middlewares/file.middleware.js'

const router = express.Router()

router.post(
  '/credit-limit-upload',
  validateUser,
  isSuperAdmin,
  csvUpload().single('csvfile'),
  outputLimitCsvParseAndSave
)
router.get('/credit-limit', validateUser, getOutputLimitData)

export default router
