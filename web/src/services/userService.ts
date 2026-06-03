import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile, PublicProfile } from '../types/user'
import { isoNow } from '../utils/dateUtils'
import { upsertPublicProfile } from './sharingService'

/**
 * Check if the given UID exists in the Admins collection.
 * Returns true if the document exists (regardless of its contents).
 * Admin status is granted by creating Admins/{uid} in Firebase Console.
 */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'Admins', uid))
    return snap.exists()
  } catch {
    return false  // Don't block sign-in if Admins collection doesn't exist yet
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'User_Data', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function createUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const now = isoNow()
  // setDoc with merge:true — safe to call even if doc already exists
  await setDoc(doc(db, 'User_Data', uid), {
    user_id: uid,
    Full_Name: data.Full_Name ?? '',
    Email: data.Email ?? '',
    Username: data.Username ?? '',
    Passport_Number: '',
    Passport_Issuing_Country: '',
    Admin: false,
    Profile_Image: data.Profile_Image ?? '',
    Phone_Number: '',
    onboardingComplete: false,
    appMode: 'personal',
    Created: now,
    Updated: now,
  }, { merge: true })
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  // setDoc with merge:true so it works whether the doc exists or not
  await setDoc(doc(db, 'User_Data', uid), { ...data, Updated: isoNow() }, { merge: true })

  // Keep the public sharing profile in sync when name/email/photo changes
  if (data.Full_Name || data.Email || data.Profile_Image) {
    const full = await getUserProfile(uid)
    if (full) {
      await upsertPublicProfile({
        uid,
        displayName: full.Full_Name,
        email:       full.Email.toLowerCase(),
        photoURL:    full.Profile_Image ?? undefined,
      }).catch(() => { /* non-critical */ })
    }
  }
}

/**
 * Normalize a passport number for indexing (uppercase, no spaces/dashes).
 */
function normalizePassport(n: string) {
  return n.toUpperCase().replace(/[\s\-]/g, '')
}

/**
 * Check if a passport number is already registered by a DIFFERENT user.
 * Returns the conflicting uid, or null if free to use.
 */
export async function checkPassportTaken(passportNumber: string, currentUid: string): Promise<string | null> {
  const normalized = normalizePassport(passportNumber)
  if (!normalized) return null
  const snap = await getDoc(doc(db, 'Passport_Index', normalized))
  if (!snap.exists()) return null
  const existing = snap.data() as { uid: string }
  return existing.uid !== currentUid ? existing.uid : null
}

export async function completeOnboarding(uid: string, data: Partial<UserProfile>): Promise<void> {
  const firstName = (data.Full_Name ?? '').split(' ')[0] || 'User'
  const batch = writeBatch(db)

  // Use set+merge so this works even if the doc was never created (e.g. first
  // sign-in failed silently). This is idempotent — safe to call multiple times.
  batch.set(
    doc(db, 'User_Data', uid),
    { ...data, onboardingComplete: true, Updated: isoNow() },
    { merge: true }
  )

  // Write public profile — first name only, readable without auth for QR verify
  const pubProfile: PublicProfile = { firstName }
  batch.set(doc(db, 'User_Data', uid, 'Public_Profile', 'summary'), pubProfile)

  // Index passport number for uniqueness checks (if provided)
  if (data.Passport_Number) {
    const normalized = normalizePassport(data.Passport_Number)
    if (normalized) {
      batch.set(doc(db, 'Passport_Index', normalized), { uid, Created: isoNow() })
    }
  }

  await batch.commit()

  // Keep the public sharing profile in sync (used for share invite lookups)
  await upsertPublicProfile({
    uid,
    displayName: data.Full_Name ?? firstName,
    email:       (data.Email ?? '').toLowerCase(),
    photoURL:    data.Profile_Image ?? undefined,
  }).catch(() => { /* non-critical — don't block onboarding */ })
}

/**
 * When a user updates their passport number from the profile page,
 * remove the old index entry and add the new one.
 */
export async function updatePassportIndex(
  uid: string,
  oldNumber: string | undefined,
  newNumber: string | undefined
): Promise<void> {
  const oldNorm = oldNumber ? normalizePassport(oldNumber) : ''
  const newNorm = newNumber ? normalizePassport(newNumber) : ''
  if (oldNorm === newNorm) return  // nothing changed

  const batch = writeBatch(db)
  if (oldNorm) batch.delete(doc(db, 'Passport_Index', oldNorm))
  if (newNorm) batch.set(doc(db, 'Passport_Index', newNorm), { uid, Created: isoNow() })
  await batch.commit()
}

