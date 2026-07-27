import mongoose from 'mongoose'

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    username: {
      type: String,
    },
    companyId: {
      type: String,
    },
    companyName: {
      type: String,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    service: {
      type: String,
      required: true,
      default: 'General Technical Issue',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
  },
  {
    timestamps: true,
  }
)

export const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema)
