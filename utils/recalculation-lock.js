import { RecalculationLock } from '../models/recalculation-lock.model.js'

export async function acquireLock(distributorCode) {
  try {
    await RecalculationLock.create({ distributorCode, lockedAt: new Date() })
    return true
  } catch (err) {
    if (err.code === 11000) return false
    throw err
  }
}

export async function releaseLock(distributorCode) {
  await RecalculationLock.deleteOne({ distributorCode })
}
