/**
 * petsService — CRUD for the top-level /Pets collection.
 *
 * Each document has ownerId + members[] for multi-user access
 * (e.g. both partners in a household, a vet, a pet-sitter).
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore'
export { deleteField } from 'firebase/firestore'
import { db } from '../firebase'
import type { Pet, PetVaccine } from '../types/pet'
import { isoNow } from '../utils/dateUtils'

const COL = 'Pets'
function petsCol() { return collection(db, COL) }
function petVaxCol(petId: string) { return collection(db, COL, petId, 'Vaccines') }

export type PetInput = Omit<Pet, 'id' | 'createdAt' | 'ownerId' | 'members'>

// ── Pets ──────────────────────────────────────────────────────────────────────

export async function getPets(uid: string): Promise<Pet[]> {
  // Dual-read: top-level shared collection + legacy per-user subcollection.
  // allSettled so a permission error on one path never silences the other.
  const [newResult, legacyResult] = await Promise.allSettled([
    getDocs(query(petsCol(), where('members', 'array-contains', uid))),
    getDocs(collection(db, 'User_Data', uid, 'Pets')),
  ])

  const map = new Map<string, Pet>()

  // Legacy data first (lower priority — no ownerId/members yet)
  if (legacyResult.status === 'fulfilled') {
    legacyResult.value.docs.forEach(d =>
      map.set(d.id, { ownerId: uid, members: [uid], ...d.data(), id: d.id } as Pet)
    )
  }
  // New collection overrides any matching legacy records
  if (newResult.status === 'fulfilled') {
    newResult.value.docs.forEach(d =>
      map.set(d.id, { id: d.id, ...d.data() } as Pet)
    )
  }

  return Array.from(map.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPet(uid: string, petId: string): Promise<Pet | null> {
  // Try new collection first, fall back to legacy
  const newSnap = await getDoc(doc(petsCol(), petId))
  if (newSnap.exists()) return { id: newSnap.id, ...newSnap.data() } as Pet
  const legacySnap = await getDoc(doc(db, 'User_Data', uid, 'Pets', petId))
  if (legacySnap.exists()) return { ownerId: uid, members: [uid], ...legacySnap.data(), id: legacySnap.id } as Pet
  return null
}

export async function addPet(uid: string, data: PetInput): Promise<string> {
  const ref = await addDoc(petsCol(), {
    ...data,
    ownerId: uid,
    members: [uid],
    createdAt: isoNow(),
  })
  return ref.id
}

export async function updatePet(
  uid: string,
  petId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const newRef = doc(petsCol(), petId)
  const snap = await getDoc(newRef)
  if (snap.exists()) {
    await updateDoc(newRef, data)
  } else {
    // Legacy pet — stored in per-user subcollection before the shared-collection migration
    await updateDoc(doc(db, 'User_Data', uid, 'Pets', petId), data)
  }
}

export async function deletePet(_uid: string, petId: string): Promise<void> {
  await deleteDoc(doc(petsCol(), petId))
}

// ── Member management ─────────────────────────────────────────────────────────

export async function addPetMember(petId: string, uid: string): Promise<void> {
  await updateDoc(doc(petsCol(), petId), { members: arrayUnion(uid) })
}

export async function removePetMember(petId: string, uid: string): Promise<void> {
  await updateDoc(doc(petsCol(), petId), { members: arrayRemove(uid) })
}

// ── Vaccines ──────────────────────────────────────────────────────────────────

export async function getPetVaccines(uid: string, petId: string): Promise<PetVaccine[]> {
  // Try new collection first; if empty, check legacy path
  const newSnap = await getDocs(query(petVaxCol(petId), orderBy('date_administration', 'desc')))
  if (!newSnap.empty) return newSnap.docs.map(d => ({ ...d.data(), pet_vaccine_id: d.id }) as PetVaccine)

  const legacySnap = await getDocs(
    query(collection(db, 'User_Data', uid, 'Pets', petId, 'Vaccines'), orderBy('date_administration', 'desc')),
  )

  // If legacy vaccines exist and the top-level doc is present, migrate them up so
  // shared users (who can't read User_Data/{uid}/...) can see the records.
  if (!legacySnap.empty) {
    try {
      if ((await getDoc(doc(petsCol(), petId))).exists()) {
        const batch = writeBatch(db)
        legacySnap.docs.forEach(d => batch.set(doc(petVaxCol(petId), d.id), d.data()))
        await batch.commit()
      }
    } catch { /* non-fatal — return legacy vaccines regardless */ }
  }

  return legacySnap.docs.map(d => ({ ...d.data(), pet_vaccine_id: d.id }) as PetVaccine)
}

export async function addPetVaccine(
  uid: string,
  petId: string,
  data: Omit<PetVaccine, 'pet_vaccine_id' | 'Created' | 'Updated'>,
): Promise<string> {
  const now = isoNow()
  // Write to whichever location the pet document lives in
  const newExists = (await getDoc(doc(petsCol(), petId))).exists()
  const col = newExists
    ? petVaxCol(petId)
    : collection(db, 'User_Data', uid, 'Pets', petId, 'Vaccines')
  const ref = await addDoc(col, { ...data, Created: now, Updated: now })
  return ref.id
}

export async function updatePetVaccine(
  uid: string,
  petId: string,
  vaccineId: string,
  data: Partial<Omit<PetVaccine, 'pet_vaccine_id' | 'Created'>>,
): Promise<void> {
  const newExists = (await getDoc(doc(petsCol(), petId))).exists()
  const ref = newExists
    ? doc(petVaxCol(petId), vaccineId)
    : doc(db, 'User_Data', uid, 'Pets', petId, 'Vaccines', vaccineId)
  await updateDoc(ref, { ...data, Updated: isoNow() })
}

export async function deletePetVaccine(
  uid: string,
  petId: string,
  vaccineId: string,
): Promise<void> {
  const newExists = (await getDoc(doc(petsCol(), petId))).exists()
  const ref = newExists
    ? doc(petVaxCol(petId), vaccineId)
    : doc(db, 'User_Data', uid, 'Pets', petId, 'Vaccines', vaccineId)
  await deleteDoc(ref)
}
