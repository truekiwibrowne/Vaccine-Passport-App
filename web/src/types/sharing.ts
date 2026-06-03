/**
 * Types for the multi-user sharing system.
 *
 * FarmAnimals, Pets and Dependents all live in top-level Firestore collections
 * with an `ownerId` (creator) and `members: string[]` (every UID with access).
 * Sharing is invite-based: the owner sends an invite by email address.
 */

export type ShareResourceType = 'farmAnimal' | 'pet' | 'dependent'

export type ShareInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

/** Minimal public profile stored at /UserPublicProfiles/{uid} — used for invite lookup */
export interface UserPublicProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
}

/** Invite envelope stored at /ShareInvites/{id} */
export interface ShareInvite {
  id: string
  resourceType: ShareResourceType
  /** Firestore document ID of the shared resource */
  resourceId: string
  /** Human-readable label shown in the invite notification */
  resourceName: string
  inviterUid: string
  inviterName: string
  inviteeEmail: string
  /** Populated once the invitee accepts */
  inviteeUid?: string
  status: ShareInviteStatus
  createdAt: string
  respondedAt?: string
}
