/**
 * sharingService — invite-based multi-user sharing for FarmAnimals, Pets and Dependents.
 *
 * Flow:
 *  1. Owner types an email → lookupUserByEmail() checks if they're registered
 *  2. sendShareInvite() creates a /ShareInvites document
 *  3. Invitee opens ShareInvitesPage → acceptInvite() or declineInvite()
 *  4. On accept: invitee is added to the resource's members[] via a transaction
 *  5. Owner can remove a member at any time via removeShareMember()
 *
 * Collections used:
 *   /UserPublicProfiles/{uid}  — created/updated whenever a user changes their profile
 *   /ShareInvites/{inviteId}   — invite envelopes
 *   /FarmAnimals | /Pets | /Dependents — members[] updated on accept/remove
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, runTransaction,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ShareInvite, ShareResourceType, UserPublicProfile } from '../types/sharing'
import { isoNow } from '../utils/dateUtils'

// ── Collection helpers ────────────────────────────────────────────────────────

function resourceColName(type: ShareResourceType): string {
  if (type === 'farmAnimal') return 'FarmAnimals'
  if (type === 'pet')        return 'Pets'
  return 'Dependents'
}

// ── Public profile CRUD ───────────────────────────────────────────────────────

/**
 * Write (or update) the caller's public profile.
 * Called from userService whenever a user's display name or email changes.
 */
export async function upsertPublicProfile(profile: UserPublicProfile): Promise<void> {
  await updateDoc(doc(db, 'UserPublicProfiles', profile.uid), {
    displayName: profile.displayName,
    email: profile.email,
    photoURL: profile.photoURL ?? null,
  }).catch(() =>
    // Document doesn't exist yet — create it
    setDoc(doc(db, 'UserPublicProfiles', profile.uid), {
      displayName: profile.displayName,
      email: profile.email,
      photoURL: profile.photoURL ?? null,
    })
  )
}

/**
 * Look up a registered user by their email address.
 * Returns null if no account is found (user has not used this app yet).
 */
export async function lookupUserByEmail(email: string): Promise<UserPublicProfile | null> {
  const q = query(
    collection(db, 'UserPublicProfiles'),
    where('email', '==', email.trim().toLowerCase()),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { uid: snap.docs[0].id, ...snap.docs[0].data() } as UserPublicProfile
}

export async function getUserPublicProfile(uid: string): Promise<UserPublicProfile | null> {
  const snap = await getDoc(doc(db, 'UserPublicProfiles', uid))
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserPublicProfile) : null
}

// ── Invite management ─────────────────────────────────────────────────────────

/**
 * Send a share invite to an email address.
 * Throws if the caller is already a member or a pending invite already exists.
 */
export async function sendShareInvite(
  inviterUid: string,
  inviterName: string,
  inviteeEmail: string,
  resourceType: ShareResourceType,
  resourceId: string,
  resourceName: string,
): Promise<string> {
  const normalEmail = inviteeEmail.trim().toLowerCase()

  // Check for existing pending invite for this resource + email
  const existing = await getDocs(query(
    collection(db, 'ShareInvites'),
    where('resourceId', '==', resourceId),
    where('inviteeEmail', '==', normalEmail),
    where('status', '==', 'pending'),
  ))
  if (!existing.empty) throw new Error('A pending invite already exists for this email.')

  // Check if they're already a member
  const resourceRef = doc(db, resourceColName(resourceType), resourceId)
  const resourceSnap = await getDoc(resourceRef)
  if (!resourceSnap.exists()) throw new Error('Resource not found.')

  const inviteeProfile = await lookupUserByEmail(normalEmail)
  if (inviteeProfile && resourceSnap.data().members?.includes(inviteeProfile.uid)) {
    throw new Error('This user already has access.')
  }

  const ref = await addDoc(collection(db, 'ShareInvites'), {
    resourceType,
    resourceId,
    resourceName,
    inviterUid,
    inviterName,
    inviteeEmail: normalEmail,
    inviteeUid:   inviteeProfile?.uid ?? null,
    status:       'pending',
    createdAt:    isoNow(),
  })
  return ref.id
}

/**
 * Get all invites relevant to this user — both sent and received.
 */
export async function getMyInvites(uid: string, email: string): Promise<ShareInvite[]> {
  const normalEmail = email.trim().toLowerCase()

  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(query(collection(db, 'ShareInvites'), where('inviterUid', '==', uid))),
    getDocs(query(
      collection(db, 'ShareInvites'),
      where('inviteeEmail', '==', normalEmail),
    )),
  ])

  const all = new Map<string, ShareInvite>()
  ;[...sentSnap.docs, ...receivedSnap.docs].forEach(d => {
    all.set(d.id, { id: d.id, ...d.data() } as ShareInvite)
  })
  return Array.from(all.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Get pending invites received by this user (for the notification badge).
 */
export async function getPendingReceivedInvites(email: string): Promise<ShareInvite[]> {
  const snap = await getDocs(query(
    collection(db, 'ShareInvites'),
    where('inviteeEmail', '==', email.trim().toLowerCase()),
    where('status', '==', 'pending'),
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ShareInvite)
}

/**
 * Accept an invite — adds the caller to the resource's members[] atomically.
 */
export async function acceptInvite(invite: ShareInvite, uid: string): Promise<void> {
  const resourceRef = doc(db, resourceColName(invite.resourceType), invite.resourceId)
  const inviteRef   = doc(db, 'ShareInvites', invite.id)

  await runTransaction(db, async tx => {
    const resourceSnap = await tx.get(resourceRef)
    if (!resourceSnap.exists()) throw new Error('The shared resource no longer exists.')

    const members: string[] = resourceSnap.data().members ?? []
    if (!members.includes(uid)) {
      tx.update(resourceRef, { members: [...members, uid] })
    }
    tx.update(inviteRef, {
      status:       'accepted',
      inviteeUid:   uid,
      respondedAt:  isoNow(),
    })
  })
}

/**
 * Decline an invite — marks it as declined, does NOT add to members.
 */
export async function declineInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'ShareInvites', inviteId), {
    status:      'declined',
    respondedAt: isoNow(),
  })
}

/**
 * Cancel a pending invite (inviter only).
 */
export async function cancelInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'ShareInvites', inviteId), {
    status:      'cancelled',
    respondedAt: isoNow(),
  })
}

/**
 * Remove a user from a resource's members[].
 * The owner can remove anyone; any member can remove themselves.
 */
export async function removeShareMember(
  resourceType: ShareResourceType,
  resourceId: string,
  memberUid: string,
): Promise<void> {
  const resourceRef = doc(db, resourceColName(resourceType), resourceId)
  const snap = await getDoc(resourceRef)
  if (!snap.exists()) return

  const members: string[] = snap.data().members ?? []
  const ownerId: string   = snap.data().ownerId  ?? ''

  if (memberUid === ownerId) throw new Error('The owner cannot be removed.')

  await updateDoc(resourceRef, { members: members.filter(m => m !== memberUid) })
}

/**
 * Get the public profiles of every member of a resource.
 */
export async function getResourceMembers(
  resourceType: ShareResourceType,
  resourceId: string,
): Promise<UserPublicProfile[]> {
  const snap = await getDoc(doc(db, resourceColName(resourceType), resourceId))
  if (!snap.exists()) return []

  const members: string[] = snap.data().members ?? []
  const ownerId: string   = snap.data().ownerId  ?? ''

  const profiles = await Promise.all(members.map(uid => getUserPublicProfile(uid)))
  return profiles
    .filter((p): p is UserPublicProfile => p !== null)
    .sort((a, b) => {
      // Owner always first
      if (a.uid === ownerId) return -1
      if (b.uid === ownerId) return 1
      return a.displayName.localeCompare(b.displayName)
    })
}

/**
 * Get pending invites sent by the owner for a specific resource
 * (so the share UI can show "awaiting response" entries).
 */
export async function getPendingInvitesForResource(resourceId: string): Promise<ShareInvite[]> {
  const snap = await getDocs(query(
    collection(db, 'ShareInvites'),
    where('resourceId', '==', resourceId),
    where('status', '==', 'pending'),
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ShareInvite)
}

/** Delete a single invite document (clean-up helper) */
export async function deleteInvite(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, 'ShareInvites', inviteId))
}
