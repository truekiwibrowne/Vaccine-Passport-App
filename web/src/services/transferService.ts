/**
 * transferService — generate and claim transfer codes for dependents, pets, and farm animals.
 *
 * Security model:
 *   - Sender creates a 6-char code (48h expiry) stored in Transfer_Codes/{code}
 *   - For pet/farm_animal transfers a companion Transfer_Code_Lookup doc is written
 *     so Firestore rules can allow the recipient to take ownership of those entities
 *   - Recipient claims the code; vaccines are copied / ownership updated
 *   - Dependent records stay in the sender's account after transfer (sender manually removes)
 */

import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, Timestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { TransferCode, TransferType } from '../types/transfer'
import type { UserVaccine } from '../types/vaccine'
import { isoNow } from '../utils/dateUtils'

const CODES_COL  = 'Transfer_Codes'
const LOOKUP_COL = 'Transfer_Code_Lookup'

function codesCol()  { return collection(db, CODES_COL)  }
function lookupCol() { return collection(db, LOOKUP_COL) }

// Unambiguous chars only (no 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const EXPIRY_HOURS = 48

function genCode(): string {
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return s
}

function lookupKey(type: TransferType, entityId: string): string {
  switch (type) {
    case 'pet':         return `pet_${entityId}`
    case 'farm_animals': return `animal_${entityId}`
    default:            return `dep_${entityId}`
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTransferCode(
  senderUid: string,
  type: TransferType,
  entityIds: string[],
  entityNames: string[],
  vaccineCount: number,
): Promise<string> {
  // Generate a unique code (retry on collision)
  let code = genCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(codesCol(), code))
    if (!existing.exists()) break
    code = genCode()
  }

  const now = Timestamp.now()
  const expiresAt = Timestamp.fromMillis(now.toMillis() + EXPIRY_HOURS * 60 * 60 * 1000)

  // For dependent transfers, embed a vaccine snapshot in the doc so the recipient
  // can read them without being a member of the dependent — no extra rule needed.
  // The sender has access to both the migrated top-level path and the legacy path.
  let vaccines: Omit<UserVaccine, 'user_vaccine_id'>[] = []
  if (type === 'dependent') {
    const depId = entityIds[0]
    let vaxSnap = await getDocs(collection(db, 'Dependents', depId, 'Vaccines'))
    if (vaxSnap.empty) {
      try {
        vaxSnap = await getDocs(
          collection(db, 'User_Data', senderUid, 'Dependents', depId, 'Vaccines'),
        )
      } catch { /* legacy path inaccessible — skip */ }
    }
    vaccines = vaxSnap.docs.map(d => d.data() as Omit<UserVaccine, 'user_vaccine_id'>)
  }

  const payload: Omit<TransferCode, 'code'> = {
    senderUid,
    type,
    entityIds,
    entityNames,
    vaccineCount,
    status: 'pending',
    expiresAt,
    createdAt: now,
    ...(vaccines.length > 0 ? { vaccines } : {}),
  }

  const batch = writeBatch(db)
  batch.set(doc(codesCol(), code), payload)

  // Write lookup docs for pet/farm_animals so rules can grant the recipient access
  if (type === 'pet' || type === 'farm_animals') {
    for (const id of entityIds) {
      const lookupDoc = doc(lookupCol(), lookupKey(type, id))
      batch.set(lookupDoc, { senderUid, code, status: 'pending', expiresAt })
    }
  }

  await batch.commit()
  return code
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTransferCode(code: string): Promise<TransferCode | null> {
  const snap = await getDoc(doc(codesCol(), code.toUpperCase().trim()))
  if (!snap.exists()) return null
  return { code: snap.id, ...snap.data() } as TransferCode
}

export async function getSenderPendingTransfers(senderUid: string): Promise<TransferCode[]> {
  const snap = await getDocs(
    query(codesCol(), where('senderUid', '==', senderUid), where('status', '==', 'pending'), orderBy('createdAt', 'desc')),
  )
  return snap.docs.map(d => ({ code: d.id, ...d.data() }) as TransferCode)
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export async function claimTransfer(code: string, recipientUid: string): Promise<void> {
  const codeDoc = doc(codesCol(), code.toUpperCase().trim())
  const snap = await getDoc(codeDoc)
  if (!snap.exists()) throw new Error('Transfer code not found.')

  const transfer = { code: snap.id, ...snap.data() } as TransferCode

  if (transfer.status !== 'pending') {
    throw new Error(transfer.status === 'claimed' ? 'This code has already been claimed.' : 'This code has been cancelled.')
  }
  if (transfer.expiresAt.toMillis() < Date.now()) {
    throw new Error('This code has expired. Ask the sender to generate a new one.')
  }
  if (transfer.senderUid === recipientUid) {
    throw new Error('You cannot claim your own transfer code.')
  }

  const claimedAt = Timestamp.now()
  const batch = writeBatch(db)

  if (transfer.type === 'dependent') {
    await _claimDependent(batch, transfer, recipientUid)
  } else if (transfer.type === 'pet') {
    await _claimPet(batch, transfer, recipientUid)
  } else if (transfer.type === 'farm_animals') {
    await _claimFarmAnimals(batch, transfer, recipientUid)
  }

  // Mark code as claimed
  batch.update(codeDoc, { status: 'claimed', claimedBy: recipientUid, claimedAt })

  // Update lookup docs
  if (transfer.type === 'pet' || transfer.type === 'farm_animals') {
    for (const id of transfer.entityIds) {
      batch.update(doc(lookupCol(), lookupKey(transfer.type, id)), { status: 'claimed' })
    }
  }

  await batch.commit()
}

async function _claimDependent(
  batch: ReturnType<typeof writeBatch>,
  transfer: TransferCode,
  recipientUid: string,
): Promise<void> {
  // Vaccines are embedded in the transfer code doc — no separate read required,
  // and no membership check is needed on the dependent.
  const vaccines = transfer.vaccines ?? []
  const now = isoNow()
  for (const vax of vaccines) {
    const newRef = doc(collection(db, 'User_Data', recipientUid, 'Vaccines'))
    batch.set(newRef, { ...vax, user_id: recipientUid, Created: now, Updated: now })
  }
}

async function _claimPet(
  batch: ReturnType<typeof writeBatch>,
  transfer: TransferCode,
  recipientUid: string,
): Promise<void> {
  for (const petId of transfer.entityIds) {
    batch.update(doc(db, 'Pets', petId), {
      ownerId: recipientUid,
      members: [recipientUid],
    })
  }
}

async function _claimFarmAnimals(
  batch: ReturnType<typeof writeBatch>,
  transfer: TransferCode,
  recipientUid: string,
): Promise<void> {
  for (const animalId of transfer.entityIds) {
    batch.update(doc(db, 'FarmAnimals', animalId), {
      ownerId: recipientUid,
      members: [recipientUid],
    })
  }
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export async function cancelTransferCode(code: string, senderUid: string): Promise<void> {
  const codeDoc = doc(codesCol(), code)
  const snap = await getDoc(codeDoc)
  if (!snap.exists()) return

  const transfer = snap.data() as TransferCode
  if (transfer.senderUid !== senderUid) throw new Error('Only the sender can cancel this code.')

  const batch = writeBatch(db)
  batch.update(codeDoc, { status: 'cancelled' })

  if (transfer.type === 'pet' || transfer.type === 'farm_animals') {
    for (const id of transfer.entityIds) {
      const lookupRef = doc(lookupCol(), lookupKey(transfer.type, id))
      batch.delete(lookupRef)
    }
  }

  await batch.commit()
}

// ── Cleanup expired codes ─────────────────────────────────────────────────────
// Called opportunistically when the sender views their pending codes.

export async function cleanupExpiredCodes(senderUid: string): Promise<void> {
  const snap = await getDocs(
    query(codesCol(), where('senderUid', '==', senderUid), where('status', '==', 'pending')),
  )
  const now = Timestamp.now()
  const expired = snap.docs.filter(d => (d.data().expiresAt as Timestamp).toMillis() < now.toMillis())
  if (expired.length === 0) return

  const batch = writeBatch(db)
  for (const d of expired) {
    batch.update(d.ref, { status: 'cancelled' })
    const transfer = d.data() as TransferCode
    if (transfer.type === 'pet' || transfer.type === 'farm_animals') {
      for (const id of transfer.entityIds) {
        batch.delete(doc(lookupCol(), lookupKey(transfer.type, id)))
      }
    }
  }
  await batch.commit()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isCodeExpired(transfer: TransferCode): boolean {
  return transfer.expiresAt.toMillis() < Date.now()
}

export function timeUntilExpiry(transfer: TransferCode): string {
  const ms = transfer.expiresAt.toMillis() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Used to pre-count vaccines when creating a code for dependents
export async function countDependentVaccines(depId: string, uid: string): Promise<number> {
  const snap = await getDocs(collection(db, 'Dependents', depId, 'Vaccines'))
  if (!snap.empty) return snap.size
  try {
    const legacySnap = await getDocs(collection(db, 'User_Data', uid, 'Dependents', depId, 'Vaccines'))
    return legacySnap.size
  } catch { return 0 }
}

export async function countPetVaccines(petId: string): Promise<number> {
  const snap = await getDocs(collection(db, 'Pets', petId, 'Vaccines'))
  return snap.size
}

export async function countFarmAnimalVaccines(animalId: string): Promise<number> {
  const snap = await getDocs(collection(db, 'FarmAnimals', animalId, 'Vaccines'))
  return snap.size
}
