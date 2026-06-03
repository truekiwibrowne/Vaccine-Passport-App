/**
 * farmService — CRUD for the top-level /FarmAnimals collection.
 *
 * Each document has:
 *   ownerId  — the UID who created it (only they can delete)
 *   members  — every UID with read+write access (includes owner)
 *
 * This design supports multi-user access (farm owner + helpers + vet)
 * without duplicating data. Firestore rules enforce the members check.
 *
 * NOTE: data that existed under the legacy User_Data/{uid}/FarmAnimals path
 * is still accessible via the old rules but will not appear in app queries.
 * Run a one-time migration script (see docs) to move it here if needed.
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { FarmAnimal, FarmVaccine } from '../types/farm'
import { isoNow } from '../utils/dateUtils'

// ── Internal helpers ──────────────────────────────────────────────────────────

const COL = 'FarmAnimals'
function farmCol() { return collection(db, COL) }
function farmVaxCol(animalId: string) { return collection(db, COL, animalId, 'Vaccines') }

/** Fields the caller provides — ownerId, members and createdAt are set by the service */
export type FarmAnimalInput = Omit<FarmAnimal, 'id' | 'createdAt' | 'ownerId' | 'members'>

// ── Animals ───────────────────────────────────────────────────────────────────

export async function getFarmAnimals(uid: string): Promise<FarmAnimal[]> {
  // Dual-read: top-level shared collection + legacy per-user subcollection
  // allSettled so a permission error on one path never silences the other.
  const [newResult, legacyResult] = await Promise.allSettled([
    getDocs(query(farmCol(), where('members', 'array-contains', uid))),
    getDocs(collection(db, 'User_Data', uid, 'FarmAnimals')),
  ])

  const map = new Map<string, FarmAnimal>()

  if (legacyResult.status === 'fulfilled') {
    legacyResult.value.docs.forEach(d =>
      map.set(d.id, { ownerId: uid, members: [uid], ...d.data(), id: d.id } as FarmAnimal)
    )
  }
  if (newResult.status === 'fulfilled') {
    newResult.value.docs.forEach(d =>
      map.set(d.id, { id: d.id, ...d.data() } as FarmAnimal)
    )
  }

  return Array.from(map.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getFarmAnimal(animalId: string, uid?: string): Promise<FarmAnimal | null> {
  const newSnap = await getDoc(doc(farmCol(), animalId))
  if (newSnap.exists()) return { id: newSnap.id, ...newSnap.data() } as FarmAnimal
  if (uid) {
    const legacySnap = await getDoc(doc(db, 'User_Data', uid, 'FarmAnimals', animalId))
    if (legacySnap.exists()) return { ownerId: uid, members: [uid], ...legacySnap.data(), id: legacySnap.id } as FarmAnimal
  }
  return null
}

export async function addFarmAnimal(uid: string, data: FarmAnimalInput): Promise<string> {
  const ref = await addDoc(farmCol(), {
    ...data,
    ownerId: uid,
    members: [uid],
    createdAt: isoNow(),
  })
  return ref.id
}

export async function updateFarmAnimal(
  _uid: string,
  animalId: string,
  data: Partial<FarmAnimalInput>,
): Promise<void> {
  await updateDoc(doc(farmCol(), animalId), data as Record<string, unknown>)
}

export async function deleteFarmAnimal(_uid: string, animalId: string): Promise<void> {
  await deleteDoc(doc(farmCol(), animalId))
}

// ── Member management (called by sharingService) ──────────────────────────────

export async function addFarmAnimalMember(animalId: string, uid: string): Promise<void> {
  await updateDoc(doc(farmCol(), animalId), { members: arrayUnion(uid) })
}

export async function removeFarmAnimalMember(animalId: string, uid: string): Promise<void> {
  await updateDoc(doc(farmCol(), animalId), { members: arrayRemove(uid) })
}

// ── Bulk import ───────────────────────────────────────────────────────────────

/**
 * Bulk-import animals parsed from CSV/Excel.
 * Writes in chunks of 450 to stay well under Firestore's 500 ops/batch limit.
 * Returns the count of successfully written documents.
 */
export async function bulkAddFarmAnimals(
  uid: string,
  animals: FarmAnimalInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const CHUNK = 450
  const now = isoNow()
  let written = 0

  for (let i = 0; i < animals.length; i += CHUNK) {
    const chunk = animals.slice(i, i + CHUNK)
    const batch = writeBatch(db)
    chunk.forEach(animal => {
      const ref = doc(farmCol())           // auto-id
      batch.set(ref, { ...animal, ownerId: uid, members: [uid], createdAt: now })
    })
    await batch.commit()
    written += chunk.length
    onProgress?.(written, animals.length)
  }

  return written
}

// ── Vaccines ──────────────────────────────────────────────────────────────────

export async function getFarmVaccines(uid: string, animalId: string): Promise<FarmVaccine[]> {
  const newSnap = await getDocs(query(farmVaxCol(animalId), orderBy('date_administration', 'desc')))
  if (!newSnap.empty) return newSnap.docs.map(d => ({ ...d.data(), farm_vaccine_id: d.id }) as FarmVaccine)

  if (uid) {
    const legacySnap = await getDocs(
      query(collection(db, 'User_Data', uid, 'FarmAnimals', animalId, 'Vaccines'), orderBy('date_administration', 'desc')),
    )
    return legacySnap.docs.map(d => ({ ...d.data(), farm_vaccine_id: d.id }) as FarmVaccine)
  }
  return []
}

export async function addFarmVaccine(
  uid: string,
  animalId: string,
  data: Omit<FarmVaccine, 'farm_vaccine_id' | 'Created' | 'Updated'>,
): Promise<string> {
  const now = isoNow()
  const newExists = (await getDoc(doc(farmCol(), animalId))).exists()
  const col = newExists
    ? farmVaxCol(animalId)
    : collection(db, 'User_Data', uid, 'FarmAnimals', animalId, 'Vaccines')
  const ref = await addDoc(col, { ...data, Created: now, Updated: now })
  return ref.id
}

export async function updateFarmVaccine(
  uid: string,
  animalId: string,
  vaccineId: string,
  data: Partial<Omit<FarmVaccine, 'farm_vaccine_id' | 'Created'>>,
): Promise<void> {
  const newExists = (await getDoc(doc(farmCol(), animalId))).exists()
  const ref = newExists
    ? doc(farmVaxCol(animalId), vaccineId)
    : doc(db, 'User_Data', uid, 'FarmAnimals', animalId, 'Vaccines', vaccineId)
  await updateDoc(ref, { ...data, Updated: isoNow() })
}

export async function deleteFarmVaccine(
  uid: string,
  animalId: string,
  vaccineId: string,
): Promise<void> {
  const newExists = (await getDoc(doc(farmCol(), animalId))).exists()
  const ref = newExists
    ? doc(farmVaxCol(animalId), vaccineId)
    : doc(db, 'User_Data', uid, 'FarmAnimals', animalId, 'Vaccines', vaccineId)
  await deleteDoc(ref)
}
