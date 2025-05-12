import dotenv from 'dotenv'
dotenv.config({
  path: './.env',
})

export const ENV = {
  MONGODB_URL: String(process.env.MONGODB_URL),
  MONGODB_URL_LOCAL: String(process.env.MONGODB_URL_LOCAL),
  JWT_SECRET: String(process.env.JWT_SECRET),
  FTP_HOST: String(process.env.FTP_HOST),
  FTP_USER: String(process.env.FTP_USER),
  FTP_PASS: String(process.env.FTP_PASS),
}
