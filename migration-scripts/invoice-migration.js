import { EMAIL_STATUS } from '../conf/index.js'
import { connectDB } from '../db.js'
import { Invoice } from '../models/invoice.model.js'

async function updateDocWithEmailStatus() {
  try {
    await connectDB().then(async () => {
      const queryResult = await Invoice.updateMany(
        {},
        { $set: { emailStatus: EMAIL_STATUS.NOT_ELIGIBLE } }
      )
      console.log(queryResult)
    })
    return
  } catch (err) {
    console.log(err)
  }
}

await updateDocWithEmailStatus()
