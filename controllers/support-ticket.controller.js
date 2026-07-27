import mongoose from 'mongoose'
import { SupportTicket } from '../models/support-ticket.model.js'
import { User } from '../models/user.model.js'

function formatDate(date) {
  if (!date) return null
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const createSupportTicket = async (req, res) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { title, service, priority, description } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Issue title is required' })
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Issue description is required' })
    }

    // Try to resolve DB User document for userId reference
    let dbUser = null
    if (user.username) {
      dbUser = await User.findOne({ username: user.username })
    } else if (user._id || user.id) {
      dbUser = await User.findById(user._id || user.id)
    }

    // Generate ST-XXXX Ticket ID
    const lastTicket = await SupportTicket.findOne().sort({ createdAt: -1 })
    let nextNum = 1001
    if (lastTicket && lastTicket.ticketId) {
      const match = lastTicket.ticketId.match(/\d+/)
      if (match) {
        nextNum = parseInt(match[0], 10) + 1
      }
    }
    const ticketId = `ST-${nextNum}`

    const ticket = new SupportTicket({
      ticketId,
      userId: dbUser?._id || user._id || user.id || null,
      username: user.username || dbUser?.username || 'N/A',
      companyId: user.companyId || dbUser?.companyId || 'N/A',
      companyName: user.companyName || dbUser?.companyName || 'N/A',
      title: title.trim(),
      service: service || 'General Technical Issue',
      priority: priority || 'Medium',
      description: description.trim(),
      status: 'OPEN',
    })

    await ticket.save()

    return res.status(201).json({
      message: 'Support ticket created successfully',
      data: {
        ticket_id: ticket.ticketId,
        status: ticket.status,
        created_at: formatDate(ticket.createdAt),
      },
    })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return res.status(500).json({
      error: 'Failed to create support ticket',
      detail: error.message,
    })
  }
}

export const getSupportTicketHistory = async (req, res) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const userRole = String(user.role || '').toLowerCase()
    const isAdmin = ['admin', 'superadmin'].includes(userRole)

    let tickets
    if (isAdmin) {
      tickets = await SupportTicket.find().sort({ createdAt: -1 })
    } else {
      tickets = await SupportTicket.find({
        $or: [{ userId: user._id }, { username: user.username }],
      }).sort({ createdAt: -1 })
    }

    const formattedTickets = tickets.map((t) => ({
      ticket_id: t.ticketId,
      title: t.title,
      service: t.service,
      priority: t.priority,
      description: t.description,
      status: t.status,
      created_at: formatDate(t.createdAt),
      user_id: t.userId,
      username: t.username,
      company_name: t.companyName,
    }))

    return res.status(200).json({
      message: 'Support ticket history fetched successfully',
      data: formattedTickets,
    })
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return res.status(500).json({
      error: 'Failed to fetch support ticket history',
      detail: error.message,
    })
  }
}

export const updateSupportTicketStatus = async (req, res) => {
  try {
    const user = req.user
    const userRole = String(user?.role || '').toLowerCase()
    const isAdmin = ['admin', 'superadmin'].includes(userRole)

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Permission denied. Only admins and superAdmins can update ticket status.',
      })
    }

    const { ticketId } = req.params
    const { status: newStatus } = req.body

    const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
    const normalizedStatus = String(newStatus || '').toUpperCase()

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      })
    }

    let ticket = await SupportTicket.findOne({ ticketId: ticketId })
    if (!ticket && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await SupportTicket.findOne({ _id: ticketId })
    }

    if (!ticket) {
      return res.status(404).json({
        error: `Support ticket '${ticketId}' not found`,
      })
    }

    ticket.status = normalizedStatus
    await ticket.save()

    return res.status(200).json({
      message: `Ticket status updated to ${normalizedStatus}`,
      data: {
        ticket_id: ticket.ticketId,
        status: ticket.status,
      },
    })
  } catch (error) {
    console.error('Error updating support ticket status:', error)
    return res.status(500).json({
      error: 'Failed to update ticket status',
      detail: error.message,
    })
  }
}
