import express from 'express'
import { getUsers, updateUserRole } from '../controllers/user.controller.js'
import { validateUser } from '../middlewares/auth.js'
const router = express.Router()

router.get('/users', validateUser, getUsers)
router.put('/user/:id', validateUser, updateUserRole)

export default router
