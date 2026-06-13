import type { Timestamp } from 'firebase/firestore'
import type { ShareResourceType } from './sharing'

export type ShareCodeStatus = 'pending' | 'claimed' | 'cancelled'

export interface ShareCode {
  code: string
  senderUid: string
  // Single-resource share (pet, dependent, farmAnimal)
  resourceType: ShareResourceType | 'farmGroup'
  resourceId?: string
  resourceName?: string
  // Multi-animal group share (farmGroup)
  entityIds?: string[]
  entityNames?: string[]
  status: ShareCodeStatus
  expiresAt: Timestamp
  claimedBy?: string
  claimedAt?: Timestamp
  createdAt: Timestamp
}
