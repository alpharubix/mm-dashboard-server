import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

export const ENV = {
  MONGODB_URL: String(process.env.MONGODB_URL),
  MONGODB_URL_LOCAL: String(process.env.MONGODB_URL_LOCAL),
  MONGODB_DB_NAME: String(process.env.MONGODB_DB_NAME),
  JWT_SECRET: String(process.env.JWT_SECRET),
  CLIENT_ID: String(process.env.CLIENT_ID),
  CLIENT_X509_CERT_URL: String(process.env.CLIENT_X509_CERT_URL),
  PRIVATE_KEY_ID: String(process.env.PRIVATE_KEY_ID),
  PROJECT_ID: String(process.env.PROJECT_ID),
  DB_NAME: String(process.env.DB_NAME),
  PRIVATE_KEY: String(process.env.PRIVATE_KEY),
  CLIENT_EMAIL: String(process.env.CLIENT_EMAIL),
  BUCKET_NAME: String(process.env.BUCKET_NAME),
}

export const NULL_VALUES = [
  null,
  '',
  'NA',
  'N/A',
  'NULL',
  'null',
  '-',
  'nil',
  'none',
  0,
  '0',
  '.',
  '_',
]
