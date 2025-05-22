import { Storage } from '@google-cloud/storage'
import { ENV } from '../conf/index.js'
import { serviceAccount } from '../conf/serviceAccount.js'

const storage = new Storage({
  credentials: serviceAccount,
  projectId: serviceAccount.project_id,
})

const bucket = storage.bucket(ENV.BUCKET_NAME)

export const uploadPDF = async (localPath, destFileName) => {
  try {
    console.log(
      `Attempting to upload: ${localPath} to gs://${bucket.name}/${destFileName}`
    )
    await bucket.upload(localPath, {
      destination: destFileName,
      public: true,
      metadata: {
        contentType: 'application/pdf',
      },
    })
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destFileName}`
    console.log(`Successfully uploaded. Public URL: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.error('Upload failed:', err)
    throw err
  }
}
