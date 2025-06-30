import express from 'express'
import { getViewerData } from '../controllers/viewer.controller.js'
import { validateUser } from '../middlewares/user.middleware.js'

const router = express.Router()

router.get('/viewer-data', validateUser, getViewerData)

export default router
