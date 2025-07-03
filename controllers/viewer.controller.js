import { Onboard } from '../models/onboard.model.js'
import { CreditLimit } from '../models/credit-limit.model.js'
import { Invoice } from '../models/invoice.model.js'

export const getViewerData = async (req, res) => {
  const user = req.user
  if (user.role === 'viewer') {
    const data = {}
    const distributorCode = user.companyId
    try {
      const onBoardData = await Onboard.findOne(
        { distributorCode: distributorCode },
        {
          distributorCode: 1,
          sanctionLimit: 1,
          limitLiveDate: 1,
          anchorId: 1,
          _id: 0,
        }
      )
      data.onBoardData = onBoardData
      const credLimit = await CreditLimit.findOne(
        { distributorCode: distributorCode },
        {
          distributorCode: 1,
          utilisedLimit: 1,
          overdue: 1,
          anchorId: 1,
          _id: 0,
        }
      )
      data.credLimit = credLimit
      const invoiceData = await Invoice.find(
        { distributorCode: distributorCode },
        {
          distributorCode: 1,
          _id: 0,
          loanAmount: 1,
          loanDisbursementDate: 1,
          anchorId: 1,
          utr: 1,
          invoiceAmount: 1,
          invoiceNumber: 1,
          invoiceDate: 1,
          status: 1,
        }
      )
      data.invoiceData = invoiceData
      res.status(200).json({ data })
    } catch (error) {
      console.log('unable to query the db')
      res.status(500).json({ message: 'Internal server  error' })
    }
  } else {
    res.status(401).json({ message: 'forbidden access' })
  }
}
