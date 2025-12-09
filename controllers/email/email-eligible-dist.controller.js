import { EMAIL_STATUS, INV_STATUS } from '../../conf/index.js'
import { Distributor } from '../../models/distributor-list.model.js'
import { getInvoicesBasedOnEmailStatus } from './email-service/service.js'
export async function getAllowdedDistEmailCount(req, res) {
  let page = req.query.page
  const limit = 10
  if (!page) {
    page = 1
  }
  try {
    const totalpages = Math.ceil(
      (await Distributor.estimatedDocumentCount()) / limit
    )
    const skip = page * limit - (page - 1)
    const data = await Distributor.find(
      {},
      { _id: 0, createdAt: 0, updatedAt: 0, __v: 0 }
    )
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
        currentPage: Number(page),
        totalPage: totalpages,
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
