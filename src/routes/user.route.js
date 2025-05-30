import express from 'express'
import { getUsers, updateUserRole } from '../controllers/user.controller.js'

const router = express.Router()

router.get('/users', getUsers)
router.put('/user/:id', updateUserRole)

export default router
