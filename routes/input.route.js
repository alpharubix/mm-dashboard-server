import { Router } from 'express'
import { getInputData } from '../controllers/input.controller.js'
const router = Router()

router.get('/input', getInputData)

export default router
