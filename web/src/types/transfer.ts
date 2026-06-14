import type { Timestamp } from 'firebase/firestore'
import type { UserVaccine } from './vaccine'

export type TransferType = 'dependent' | 'pet' | 'farm_animals'
export type TransferStatus = 'pending' | 'claimed' | 'cancelled'

export interface TransferCode {
  code: string
  senderUid: string
  type: TransferType
  /** depId, petId, or one-or-more animalIds */
  entityIds: string[]
  /** Human-readable labels for preview (name or tag number) */
  entityNames: string[]
  vaccineCount: number
  status: TransferStatus
  expiresAt: Timestamp
  claimedBy?: string
  claimedAt?: Timestamp
  createdAt: Timestamp
  /** Vaccine snapshot embedded for dependent transfers — recipient reads from here */
  vaccines?: Omit<UserVaccine, 'user_vaccine_id'>[]
}
