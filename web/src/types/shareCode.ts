import type { Timestamp } from 'firebase/firestore'
import type { ShareResourceType } from './sharing'

export type ShareCodeStatus = 'pending' | 'claimed' | 'cancelled'

export interface ShareCode {
  code: string
  senderUid: string
  resourceType: ShareResourceType
  resourceId: string
  resourceName: string
  status: ShareCodeStatus
  expiresAt: Timestamp
  claimedBy?: string
  claimedAt?: Timestamp
  createdAt: Timestamp
}
