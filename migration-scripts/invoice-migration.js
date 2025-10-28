import { Invoice } from '../models/invoice.model.js'
import { connectDB } from '../db.js'

async function updateDocWithEmailStatus() {
  try {
    await connectDB().then(async () => {
      const queryResult = await Invoice.updateMany(
        {},
        { $set: { emailStatus: 'eligible' } }
      )
      console.log(queryResult)
    })
    return
  } catch (err) {
    console.log(err)
  }
}

await updateDocWithEmailStatus()
