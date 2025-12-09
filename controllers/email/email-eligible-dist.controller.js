import { EMAIL_STATUS, INV_STATUS } from '../../conf/index.js'
import { Distributor } from '../../models/distributor-list.model.js'
import { getInvoicesBasedOnEmailStatus } from './email-service/service.js'
export async function getAllowdedDistEmailCount(req, res) {
  let page = req.query.page
  let companyName = req.query.companyName
  let distCode = req.query.distributorCode
  const limit = 10
  if (!page) {
    page = 1
  }
  try {
    let filter = {}
    if (companyName) {
      filter.companyName = new RegExp(companyName, 'i')
    }
    if (distCode) {
      filter.distributorCode = new RegExp(distCode, 'i')
    }
    const totalDocs = (await Distributor.find(filter)).length
    console.log('Total docs', totalDocs)
    const totalpages = Math.ceil(totalDocs / limit)
    const skip = (page - 1) * limit
    const data = await Distributor.find(filter, {
      _id: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    })
      .skip(skip)
      .limit(limit * page)
      .lean()
    for (let dist of data) {
      let totalEligibleInvoiceCount = (
        await getInvoicesBasedOnEmailStatus(
          dist.distributorCode,
          EMAIL_STATUS.ELIGIBLE
        )
      ).length
      dist.totalEligibleInvoiceCount = totalEligibleInvoiceCount
    }
    return res.status(200).json({
      data: data,
      pageInfo: {
        page: Number(page),
        totalPage: totalpages,
        total: totalDocs,
        skip: skip,
      },
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
