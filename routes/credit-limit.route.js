import express from 'express'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { uploadCsv } from '../middlewares/file.middleware.js'
import { creditLimitCsvParseAndSave } from '../controllers/credit-limit/credit-limit.controller.js'
import { getCreditLimitData } from '../controllers/credit-limit/get-credit-limit.controller.js'

const router = express.Router()

router.post(
  '/credit-limit-upload',
  validateUser,
  isSuperAdmin,
  uploadCsv().single('csvfile'),
  creditLimitCsvParseAndSave
)
router.get('/credit-limit', validateUser, getCreditLimitData)

export default router
