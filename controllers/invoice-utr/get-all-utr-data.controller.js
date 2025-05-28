import { OutputUTR } from '../../models/output-utr.model.js'

export const getAllOutputUtrData = async (req, res) => {
  const user = req.user
    if(user.role === 'superAdmin'){
  try {
    const data = await OutputUTR.find().sort({ invoiceDate: -1 })

    res.status(200).json({
      message: 'Fetched all Output UTR data successfully',
      data,
      total: data.length,
    })
  } catch (error) {
    console.error('Error fetching all Output UTR data:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}else{
  try {
    const companyId = user.companyId
    const data = await OutputUTR.find({distributorCode:companyId},{distributorCode:1,invoiceNumber:1,loanAmount:1,loanDisbursementDate:1,utr:1,status:1})
    if(data.length===0){
      res.status(204)}
      res.status(200).json({'data':data})  
  } catch (error) {
    res.status(500).json({"message":"Internal Server Error"})
  }
}
}
