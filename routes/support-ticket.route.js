import express from 'express'
import { validateUser } from '../middlewares/user.middleware.js'
import { isAdminOrSuperAdmin } from '../middlewares/role.middleware.js'
import {
  createSupportTicket,
  getSupportTicketHistory,
  updateSupportTicketStatus,
} from '../controllers/support-ticket.controller.js'

const router = express.Router()

router.post('/support-ticket/create', validateUser, isAdminOrSuperAdmin, createSupportTicket)
router.get('/support-ticket/history', validateUser, isAdminOrSuperAdmin, getSupportTicketHistory)
router.put('/support-ticket/:ticketId/status', validateUser, isAdminOrSuperAdmin, updateSupportTicketStatus)
router.patch('/support-ticket/:ticketId/status', validateUser, isAdminOrSuperAdmin, updateSupportTicketStatus)

export default router
