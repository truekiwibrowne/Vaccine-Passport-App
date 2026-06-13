import {
  doc, getDoc, setDoc, updateDoc, writeBatch, arrayUnion, Timestamp,
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
  // Pets and Dependents have a legacy path (User_Data/{uid}/...). If the document
  // doesn't exist yet at the top-level collection, migrate it so the share claim
  // can write members[] to the canonical location.
  const topRef = doc(db, resourceColName(resourceType), resourceId)
  const topSnap = await getDoc(topRef)
  if (!topSnap.exists()) {
    const legacyRef =
      resourceType === 'pet'
        ? doc(db, 'User_Data', senderUid, 'Pets', resourceId)
        : resourceType === 'dependent'
          ? doc(db, 'User_Data', senderUid, 'Dependents', resourceId)
          : null
    if (legacyRef) {
      const legacySnap = await getDoc(legacyRef)
      if (legacySnap.exists()) {
        await setDoc(topRef, { ...legacySnap.data(), ownerId: senderUid, members: [senderUid] })
      }
    }
  }

  const code = generateCode()
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + EXPIRY_HOURS * 3_600_000))
  const now = Timestamp.now()
  const key = lookupKey(resourceType, resourceId)

  // If any lookup doc already exists (pending, cancelled, or claimed), delete it first.
  // batch.set() on an existing doc is treated as an update by Firestore rules, which
  // only allows cancel/claim transitions — not creating a fresh pending code.
  const existingSnap = await getDoc(doc(db, 'Share_Code_Lookup', key))
  if (existingSnap.exists()) {
    const prepareBatch = writeBatch(db)
    if (existingSnap.data().status === 'pending') {
      const oldCode = existingSnap.data().code as string
      prepareBatch.update(doc(db, 'Share_Codes', oldCode), { status: 'cancelled' })
    }
    prepareBatch.delete(doc(db, 'Share_Code_Lookup', key))
    await prepareBatch.commit()
  }

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

/** Create a single share code covering multiple farm animals. */
export async function createFarmGroupShareCode(
  senderUid: string,
  animals: Array<{ id: string; name: string }>,
): Promise<string> {
  const code = generateCode()
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + EXPIRY_HOURS * 3_600_000))
  const now = Timestamp.now()

  // Read all existing lookup docs in parallel.
  // Delete any that exist (regardless of status) — batch.set() on an existing doc
  // is treated as an update by Firestore rules and would be denied for a new pending code.
  const keys = animals.map(a => `sanimal_${a.id}`)
  const lookupSnaps = await Promise.all(keys.map(k => getDoc(doc(db, 'Share_Code_Lookup', k))))

  const pendingCodesToCancel = new Set<string>()
  const existingLookupKeys: string[] = []

  for (const snap of lookupSnaps) {
    if (snap.exists()) {
      existingLookupKeys.push(snap.id)
      if (snap.data().status === 'pending') {
        pendingCodesToCancel.add(snap.data().code as string)
      }
    }
  }

  if (existingLookupKeys.length > 0) {
    const prepareBatch = writeBatch(db)
    for (const oldCode of pendingCodesToCancel) {
      prepareBatch.update(doc(db, 'Share_Codes', oldCode), { status: 'cancelled' })
    }
    for (const k of existingLookupKeys) {
      prepareBatch.delete(doc(db, 'Share_Code_Lookup', k))
    }
    await prepareBatch.commit()
  }

  const batch = writeBatch(db)

  batch.set(doc(db, 'Share_Codes', code), {
    code,
    senderUid,
    resourceType: 'farmGroup',
    entityIds: animals.map(a => a.id),
    entityNames: animals.map(a => a.name),
    status: 'pending',
    expiresAt,
    createdAt: now,
  })

  for (const animal of animals) {
    batch.set(doc(db, 'Share_Code_Lookup', `sanimal_${animal.id}`), {
      senderUid,
      code,
      resourceType: 'farmAnimal',
      resourceId: animal.id,
      status: 'pending',
      expiresAt,
      createdAt: now,
    })
  }

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

  const now = Timestamp.now()
  const batch = writeBatch(db)

  if (sc.resourceType === 'farmGroup') {
    // Multi-animal group share — update each animal + its lookup doc
    for (const animalId of (sc.entityIds ?? [])) {
      batch.update(doc(db, 'FarmAnimals', animalId), { members: arrayUnion(recipientUid) })
      batch.update(doc(db, 'Share_Code_Lookup', `sanimal_${animalId}`), {
        status: 'claimed', claimedBy: recipientUid, claimedAt: now,
      })
    }
  } else {
    // Single-resource share
    const key = lookupKey(sc.resourceType as ShareResourceType, sc.resourceId!)
    batch.update(doc(db, resourceColName(sc.resourceType as ShareResourceType), sc.resourceId!), {
      members: arrayUnion(recipientUid),
    })
    batch.update(doc(db, 'Share_Code_Lookup', key), {
      status: 'claimed', claimedBy: recipientUid, claimedAt: now,
    })
  }

  batch.update(doc(db, 'Share_Codes', code), {
    status: 'claimed', claimedBy: recipientUid, claimedAt: now,
  })

  await batch.commit()
}

export async function cancelShareCode(code: string, senderUid: string): Promise<void> {
  const sc = await getShareCode(code)
  if (!sc) throw new Error('Code not found.')
  if (sc.senderUid !== senderUid) throw new Error('Not authorised.')

  const batch = writeBatch(db)
  batch.update(doc(db, 'Share_Codes', code), { status: 'cancelled' })

  if (sc.resourceType === 'farmGroup') {
    for (const animalId of (sc.entityIds ?? [])) {
      batch.update(doc(db, 'Share_Code_Lookup', `sanimal_${animalId}`), { status: 'cancelled' })
    }
  } else {
    const key = lookupKey(sc.resourceType as ShareResourceType, sc.resourceId!)
    batch.update(doc(db, 'Share_Code_Lookup', key), { status: 'cancelled' })
  }

  await batch.commit()
}
