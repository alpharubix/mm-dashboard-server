import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['superAdmin', 'admin', 'viewer'],
      required: true,
    },
    companyId:{
      type:String,
      required:true,
      unique:true
    }
  },
  {
  timestamps: true,
  },{versionKey: false}
)

export const User = mongoose.model('User', UserSchema)
