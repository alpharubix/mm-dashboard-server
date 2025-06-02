import express from 'express'
import { validateUser } from '../middlewares/auth.js'
import { getViewerData } from '../controllers/viewer.controller.js'
const router = express.Router()
router.get('/viewer-data', validateUser, getViewerData)
export default router
