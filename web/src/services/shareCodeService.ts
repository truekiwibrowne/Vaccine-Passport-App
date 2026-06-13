import {
  doc, getDoc, setDoc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ShareCode } from '../types/shareCode'
import type { ShareResourceType } from '../types/sharing'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const EXPIRY_HOURS = 48

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

function lookupKey(resourceType: ShareResourceType, resourceId: string): string {
  if (resourceType === 'pet')        return `spet_${resourceId}`
  if (resourceType === 'farmAnimal') return `sanimal_${resourceId}`
  return `sdep_${resourceId}`
}

function resourceColName(type: ShareResourceType): string {
  if (type === 'farmAnimal') return 'FarmAnimals'
  if (type === 'pet')        return 'Pets'
  return 'Dependents'
}

export function isShareCodeExpired(sc: ShareCode): boolean {
  return sc.expiresAt.toDate() < new Date()
}

export function shareCodeTimeUntilExpiry(sc: ShareCode): string {
  const ms = sc.expiresAt.toDate().getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export async function createShareCode(
  senderUid: string,
  resourceType: ShareResourceType,
  resourceId: string,
  resourceName: string,
): Promise<string> {
  const code = generateCode()
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + EXPIRY_HOURS * 3_600_000))
  const now = Timestamp.now()
  const key = lookupKey(resourceType, resourceId)

  const batch = writeBatch(db)

  batch.set(doc(db, 'Share_Codes', code), {
    code,
    senderUid,
    resourceType,
    resourceId,
    resourceName,
    status: 'pending',
    expiresAt,
    createdAt: now,
  })

  batch.set(doc(db, 'Share_Code_Lookup', key), {
    senderUid,
    code,
    resourceType,
    resourceId,
    status: 'pending',
    expiresAt,
    createdAt: now,
  })

  await batch.commit()
  return code
}

export async function getShareCode(code: string): Promise<ShareCode | null> {
  const snap = await getDoc(doc(db, 'Share_Codes', code))
  if (!snap.exists()) return null
  return { code: snap.id, ...snap.data() } as ShareCode
}

export async function getActiveShareCodeForResource(
  senderUid: string,
  resourceType: ShareResourceType,
  resourceId: string,
): Promise<ShareCode | null> {
  const key = lookupKey(resourceType, resourceId)
  const lookupSnap = await getDoc(doc(db, 'Share_Code_Lookup', key))
  if (!lookupSnap.exists()) return null
  const lookup = lookupSnap.data()
  if (lookup.status !== 'pending') return null
  if (lookup.senderUid !== senderUid) return null
  if ((lookup.expiresAt as Timestamp).toDate() < new Date()) return null
  const codeSnap = await getDoc(doc(db, 'Share_Codes', lookup.code))
  if (!codeSnap.exists()) return null
  return { code: codeSnap.id, ...codeSnap.data() } as ShareCode
}

export async function claimShareCode(code: string, recipientUid: string): Promise<void> {
  const sc = await getShareCode(code)
  if (!sc) throw new Error('Code not found.')
  if (sc.status !== 'pending') throw new Error('This code has already been used.')
  if (isShareCodeExpired(sc)) throw new Error('This code has expired.')
  if (sc.senderUid === recipientUid) throw new Error('You cannot claim your own code.')

  const key = lookupKey(sc.resourceType, sc.resourceId)
  const resourceRef = doc(db, resourceColName(sc.resourceType), sc.resourceId)
  const now = Timestamp.now()

  // Read current members to build the updated array (needed for Firestore rule check)
  const resourceSnap = await getDoc(resourceRef)
  if (!resourceSnap.exists()) throw new Error('The resource no longer exists.')
  const currentMembers: string[] = resourceSnap.data().members ?? []
  if (currentMembers.includes(recipientUid)) throw new Error('You already have access to this resource.')

  const batch = writeBatch(db)

  // Add recipient to members (explicit array update so Firestore rule can check size)
  batch.update(resourceRef, { members: [...currentMembers, recipientUid] })

  batch.update(doc(db, 'Share_Codes', code), {
    status: 'claimed',
    claimedBy: recipientUid,
    claimedAt: now,
  })

  batch.update(doc(db, 'Share_Code_Lookup', key), {
    status: 'claimed',
    claimedBy: recipientUid,
    claimedAt: now,
  })

  await batch.commit()
}

export async function cancelShareCode(code: string, senderUid: string): Promise<void> {
  const sc = await getShareCode(code)
  if (!sc) throw new Error('Code not found.')
  if (sc.senderUid !== senderUid) throw new Error('Not authorised.')

  const key = lookupKey(sc.resourceType, sc.resourceId)
  const batch = writeBatch(db)

  batch.update(doc(db, 'Share_Codes', code), { status: 'cancelled' })
  batch.update(doc(db, 'Share_Code_Lookup', key), { status: 'cancelled' })

  await batch.commit()
}
