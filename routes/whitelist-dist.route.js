import express from 'express'

import getWhiteListDist from '../controllers/whitelisted-distributor/get-whitelist-dist.controller.js'
import { parseAndSaveDistributors } from '../controllers/whitelisted-distributor/upload-whitelist-dist.controller.js'

import { uploadCsv } from '../middlewares/file.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { validateUser } from '../middlewares/user.middleware.js'

const router = express.Router()

router.post(
  '/upload-distributors',
  validateUser,
  isSuperAdmin,
  uploadCsv().single('csvfile'),
  parseAndSaveDistributors
)

router.get('/whitelist-dist', validateUser, isSuperAdmin, getWhiteListDist)

export default router
