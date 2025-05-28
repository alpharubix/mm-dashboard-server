import express from 'express'
import {
  getOutputLimitData,
  outputLimitCsvParseAndSave,
} from '../controllers/output-limit.controller.js'
import upload from '../middlewares/multer.js'
import { isAllowded } from '../middlewares/fileUploadBlocker.js'
import { validateUser } from '../middlewares/auth.js'

const router = express.Router()

router.post('/output-limit-upload',validateUser,isAllowded, upload().single('csvfile'), outputLimitCsvParseAndSave)
router.get('/output-limit', validateUser,getOutputLimitData)

export default router
