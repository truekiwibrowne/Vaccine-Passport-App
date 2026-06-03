/**
 * dependentsService — CRUD for the top-level /Dependents collection.
 *
 * Each document has ownerId + members[] for multi-parent / multi-carer access
 * (e.g. two parents, a grandparent, a doctor).
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Dependent } from '../types/dependent'
import type { UserVaccine } from '../types/vaccine'
import { isoNow } from '../utils/dateUtils'

const COL = 'Dependents'
function depsCol() { return collection(db, COL) }
function depVaxCol(depId: string) { return collection(db, COL, depId, 'Vaccines') }

export type DependentInput = Omit<Dependent, 'id' | 'createdAt' | 'ownerId' | 'members'>

// ── Dependents ────────────────────────────────────────────────────────────────

export async function getDependents(uid: string): Promise<Dependent[]> {
  // Dual-read: top-level shared collection + legacy per-user subcollection
  // allSettled so a permission error on one path never silences the other.
  const [newResult, legacyResult] = await Promise.allSettled([
    getDocs(query(depsCol(), where('members', 'array-contains', uid))),
    getDocs(collection(db, 'User_Data', uid, 'Dependents')),
  ])

  const map = new Map<string, Dependent>()

  if (legacyResult.status === 'fulfilled') {
    legacyResult.value.docs.forEach(d =>
      map.set(d.id, { ownerId: uid, members: [uid], ...d.data(), id: d.id } as Dependent)
    )
  }
  if (newResult.status === 'fulfilled') {
    newResult.value.docs.forEach(d =>
      map.set(d.id, { id: d.id, ...d.data() } as Dependent)
    )
  }

  return Array.from(map.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getDependent(uid: string, depId: string): Promise<Dependent | null> {
  const newSnap = await getDoc(doc(depsCol(), depId))
  if (newSnap.exists()) return { id: newSnap.id, ...newSnap.data() } as Dependent
  const legacySnap = await getDoc(doc(db, 'User_Data', uid, 'Dependents', depId))
  if (legacySnap.exists()) return { ownerId: uid, members: [uid], ...legacySnap.data(), id: legacySnap.id } as Dependent
  return null
}

export async function addDependent(uid: string, data: DependentInput): Promise<string> {
  const ref = await addDoc(depsCol(), {
    ...data,
    ownerId: uid,
    members: [uid],
    createdAt: isoNow(),
  })
  return ref.id
}

export async function updateDependent(
  _uid: string,
  depId: string,
  data: Partial<DependentInput>,
): Promise<void> {
  await updateDoc(doc(depsCol(), depId), data as Record<string, unknown>)
}

export async function deleteDependent(_uid: string, depId: string): Promise<void> {
  await deleteDoc(doc(depsCol(), depId))
}

// ── Member management ─────────────────────────────────────────────────────────

export async function addDependentMember(depId: string, uid: string): Promise<void> {
  await updateDoc(doc(depsCol(), depId), { members: arrayUnion(uid) })
}

export async function removeDependentMember(depId: string, uid: string): Promise<void> {
  await updateDoc(doc(depsCol(), depId), { members: arrayRemove(uid) })
}

// ── Vaccines ──────────────────────────────────────────────────────────────────

export async function getDependentVaccines(uid: string, depId: string): Promise<UserVaccine[]> {
  const newSnap = await getDocs(query(depVaxCol(depId), orderBy('date_administration', 'desc')))
  if (!newSnap.empty) return newSnap.docs.map(d => ({ ...d.data(), user_vaccine_id: d.id }) as UserVaccine)

  const legacySnap = await getDocs(
    query(collection(db, 'User_Data', uid, 'Dependents', depId, 'Vaccines'), orderBy('date_administration', 'desc')),
  )
  return legacySnap.docs.map(d => ({ ...d.data(), user_vaccine_id: d.id }) as UserVaccine)
}

export async function addDependentVaccine(
  uid: string,
  depId: string,
  data: Omit<UserVaccine, 'user_vaccine_id' | 'Created' | 'Updated'>,
): Promise<string> {
  const now = isoNow()
  const newExists = (await getDoc(doc(depsCol(), depId))).exists()
  const col = newExists
    ? depVaxCol(depId)
    : collection(db, 'User_Data', uid, 'Dependents', depId, 'Vaccines')
  const ref = await addDoc(col, { ...data, Created: now, Updated: now })
  return ref.id
}

export async function updateDependentVaccine(
  uid: string,
  depId: string,
  vaccineId: string,
  data: Partial<Omit<UserVaccine, 'user_vaccine_id' | 'Created'>>,
): Promise<void> {
  const newExists = (await getDoc(doc(depsCol(), depId))).exists()
  const ref = newExists
    ? doc(depVaxCol(depId), vaccineId)
    : doc(db, 'User_Data', uid, 'Dependents', depId, 'Vaccines', vaccineId)
  await updateDoc(ref, { ...data, Updated: isoNow() })
}

export async function deleteDependentVaccine(
  uid: string,
  depId: string,
  vaccineId: string,
): Promise<void> {
  const newExists = (await getDoc(doc(depsCol(), depId))).exists()
  const ref = newExists
    ? doc(depVaxCol(depId), vaccineId)
    : doc(db, 'User_Data', uid, 'Dependents', depId, 'Vaccines', vaccineId)
  await deleteDoc(ref)
}
