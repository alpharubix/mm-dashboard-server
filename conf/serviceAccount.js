import { ENV } from './index.js'

export const serviceAccount = {
  type: 'service_account',
  project_id: ENV.PROJECT_ID,
  private_key_id: ENV.PRIVATE_KEY_ID,
  private_key: ENV.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: ENV.CLIENT_EMAIL,
  client_id: ENV.CLIENT_ID,
  client_x509_cert_url: ENV.CLIENT_X509_CERT_URL,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  universe_domain: 'googleapis.com',
}
