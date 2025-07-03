import { Storage } from '@google-cloud/storage'
import { ENV } from '../conf/index.js'
import { serviceAccount } from '../conf/serviceAccount.js'

const storage = new Storage({
  credentials: serviceAccount,
  projectId: serviceAccount.project_id,
})

const bucket = storage.bucket(ENV.BUCKET_NAME)

export const uploadPdfToGcs = async (buffer, destFileName) => {
  try {
    const gcsFile = bucket.file(destFileName)

    await gcsFile.save(buffer, {
      metadata: {
        contentType: 'application/pdf',
      },
      // public: true,
    })

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destFileName}`
    return publicUrl
  } catch (error) {
    throw new Error(`GCS upload failed: ${error.message}`)
  }
}
