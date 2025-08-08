import express from 'express'

import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { uploadCsv } from '../middlewares/file.middleware.js'
import { onboardCsvParseAndSave } from '../controllers/onboard/onboard.controller.js'
import { getOnboardData } from '../controllers/onboard/get-onboard.controller.js'

const router = express.Router()

router.post(
  '/onboard-upload',
  validateUser,
  isSuperAdmin,
  uploadCsv().single('csvfile'),
  onboardCsvParseAndSave
)
router.get('/onboard', validateUser, getOnboardData)

export default router
