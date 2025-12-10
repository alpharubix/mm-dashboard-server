import { EMAIL_STATUS } from '../../conf/index.js'
import { Distributor } from '../../models/distributor-list.model.js'
import { getInvoicesBasedOnEmailStatus } from './email-service/service.js'

export async function getAllowdedDistEmailCount(req, res) {
  const page = Number(req.query.page || 1)
  const companyName = String(req.query.companyName || '')
  const distCode = String(req.query.distributorCode || '')
  const limit = Number(req.query.limit || 10)

  try {
    const filter = {}
    if (companyName) {
      filter.companyName = new RegExp(companyName, 'i')
    }
    if (distCode) {
      filter.distributorCode = new RegExp(distCode, 'i')
    }
    const totalDocs = (await Distributor.find(filter)).length
    // console.log('Total docs', totalDocs)
    const totalPages = Math.ceil(totalDocs / limit)
    const skip = (page - 1) * limit
    const data = await Distributor.find(filter, {
      _id: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    })
      .skip(skip)
      .limit(limit)
      .lean()

    for (let dist of data) {
      let invoices = await getInvoicesBasedOnEmailStatus(
        dist.distributorCode,
        EMAIL_STATUS.ELIGIBLE
      )
      dist.totalEligibleInvoiceCount = invoices.length
      if (invoices.lenght === 0) {
        dist.invoiceNumbers = []
      } else {
        dist.invoiceNumbers = invoices.map((inv, index) => {
          return inv.invoiceNumber
        })
      }
    }

    return res.status(200).json({
      message: 'Disbursement distributor data fetched successfully',
      data,
      page,
      totalPages,
      total: totalDocs,
      skip,
    })
  } catch (err) {
    console.log(
      'Error raised while calculating the eligible invoices count',
      err
    )
    return res.status(500).json({
      message: 'Internal server error',
      error: err.message,
    })
  }
}
