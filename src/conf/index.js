import dotenv from 'dotenv'
dotenv.config()

export const ENV = {
  MONGODB_URL: String(process.env.MONGODB_URL),
  MONGODB_URL_LOCAL: String(process.env.MONGODB_URL_LOCAL),
  JWT_SECRET: String(process.env.JWT_SECRET),
  FTP_HOST: String(process.env.FTP_HOST),
  FTP_USER: String(process.env.FTP_USER),
  FTP_PASS: String(process.env.FTP_PASS),
  CLIENT_ID: String(process.env.CLIENT_ID),
  CLIENT_X509_CERT_URL: String(process.env.CLIENT_X509_CERT_URL),
  PRIVATE_KEY_ID: String(process.env.PRIVATE_KEY_ID),
  PROJECT_ID: String(process.env.PROJECT_ID),
  DB_NAME: String(process.env.DB_NAME),
  PRIVATE_KEY: String(process.env.PRIVATE_KEY),
  CLIENT_EMAIL: String(process.env.CLIENT_EMAIL),
  BUCKET_NAME: String(process.env.BUCKET_NAME),
}
