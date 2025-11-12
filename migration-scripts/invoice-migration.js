import { EMAIL_STATUS } from '../conf/index.js'
import {
  isDistributorAllowed,
  isDistributorHasOverdue,
} from '../controllers/email/email-service/service.js'
import { connectDB } from '../db.js'
import { Invoice } from '../models/invoice.model.js'

async function migration() {
  await connectDB()
  try {
    const invoices = await Invoice.find({})
    console.log(`Found ${invoices.length} invoices`)

    for (const inv of invoices) {
      let emailStatus
      const invStatus = inv.status

      if (!(await isDistributorAllowed(inv.distributorCode))) {
        emailStatus = EMAIL_STATUS.NOT_ELIGIBLE
      } else {
        switch (invStatus) {
          case 'yetToProcess':
            emailStatus = EMAIL_STATUS.ELIGIBLE
            break
          case 'inProgress':
          case 'processed':
            emailStatus = EMAIL_STATUS.SENT
            break
          case 'notProcessed':
          case 'pendingWithLender':
            emailStatus = EMAIL_STATUS.NOT_ELIGIBLE
            break
          case 'pendingWithCustomer':
            emailStatus = EMAIL_STATUS.INSUFF_AVAIL_LIMIT
            break
          default:
            emailStatus = EMAIL_STATUS.NOT_ELIGIBLE
        }

        if (await isDistributorHasOverdue(inv.distributorCode)) {
          if (
            invStatus === 'yetToProcess' ||
            invStatus === 'pendingWithCustomer'
          ) {
            emailStatus = EMAIL_STATUS.OVERDUE
          }
        }
      }

      await Invoice.updateOne({ _id: inv._id }, { $set: { emailStatus } })
    }

    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    process.exit(0)
  }
}

migration()
