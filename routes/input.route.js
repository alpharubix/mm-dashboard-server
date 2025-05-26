import { Router } from 'express'
import {
  getInputData,
  inputFtpController,
} from '../controllers/input.controller.js'
const router = Router()

router.get('/input', getInputData)
router.get('/input-ftp-data', inputFtpController)
export default router
