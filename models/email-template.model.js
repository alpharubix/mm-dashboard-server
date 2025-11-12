import mongoose from 'mongoose'

const template = new mongoose.Schema({
  templateId: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, require: true },
  cc: { type: String, require: true },
  subject: { type: String, require: true },
  body: { type: String, required: true },
})

export const EmailTemplate = mongoose.model('emailtemplates', template)
