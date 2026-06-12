/**
 * Firestore service for all three pending-submission collections.
 *
 * Collections:
 *   PendingClinics        — /PendingClinics/{id}
 *   PendingPractitioners  — /PendingPractitioners/{id}
 *   PendingVaccines       — /PendingVaccines/{id}
 */

import {
  collection, getDocs, addDoc, doc, updateDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { PendingClinic, PendingPractitioner, PendingVaccine } from '../types/pendingSubmissions'
import { isoNow } from '../utils/dateUtils'

/** Firestore rejects `undefined` values — strip them before writing. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ── Pending Clinics ──────────────────────────────────────────────────────────

export async function submitPendingClinic(
  data: Omit<PendingClinic, 'id' | 'submittedAt' | 'status' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'PendingClinics'), stripUndefined({
    ...data,
    submittedAt: isoNow(),
    status: 'pending',
  }))
  return ref.id
}

export async function getPendingClinics(): Promise<PendingClinic[]> {
  const snap = await getDocs(
    query(collection(db, 'PendingClinics'), orderBy('submittedAt', 'desc')),
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as PendingClinic)
}

export async function approvePendingClinic(id: string, reviewedBy: string): Promise<void> {
  await updateDoc(doc(db, 'PendingClinics', id), {
    status: 'approved',
    reviewedBy,
    reviewedAt: isoNow(),
  })
}

export async function rejectPendingClinic(
  id: string, reviewedBy: string, rejectionReason: string,
): Promise<void> {
  await updateDoc(doc(db, 'PendingClinics', id), {
    status: 'rejected',
    reviewedBy,
    reviewedAt: isoNow(),
    rejectionReason,
  })
}

// ── Pending Practitioners ────────────────────────────────────────────────────

export async function submitPendingPractitioner(
  data: Omit<PendingPractitioner, 'id' | 'submittedAt' | 'status' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'PendingPractitioners'), stripUndefined({
    ...data,
    submittedAt: isoNow(),
    status: 'pending',
  }))
  return ref.id
}

export async function getPendingPractitioners(): Promise<PendingPractitioner[]> {
  const snap = await getDocs(
    query(collection(db, 'PendingPractitioners'), orderBy('submittedAt', 'desc')),
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as PendingPractitioner)
}

export async function approvePendingPractitioner(id: string, reviewedBy: string): Promise<void> {
  await updateDoc(doc(db, 'PendingPractitioners', id), {
    status: 'approved',
    reviewedBy,
    reviewedAt: isoNow(),
  })
}

export async function rejectPendingPractitioner(
  id: string, reviewedBy: string, rejectionReason: string,
): Promise<void> {
  await updateDoc(doc(db, 'PendingPractitioners', id), {
    status: 'rejected',
    reviewedBy,
    reviewedAt: isoNow(),
    rejectionReason,
  })
}

// ── Pending Vaccines ─────────────────────────────────────────────────────────

export async function submitPendingVaccine(
  data: Omit<PendingVaccine, 'id' | 'submittedAt' | 'status' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'PendingVaccines'), stripUndefined({
    ...data,
    submittedAt: isoNow(),
    status: 'pending',
  }))
  return ref.id
}

export async function getPendingVaccines(): Promise<PendingVaccine[]> {
  const snap = await getDocs(
    query(collection(db, 'PendingVaccines'), orderBy('submittedAt', 'desc')),
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as PendingVaccine)
}

export async function approvePendingVaccine(id: string, reviewedBy: string): Promise<void> {
  await updateDoc(doc(db, 'PendingVaccines', id), {
    status: 'approved',
    reviewedBy,
    reviewedAt: isoNow(),
  })
}

export async function rejectPendingVaccine(
  id: string, reviewedBy: string, rejectionReason: string,
): Promise<void> {
  await updateDoc(doc(db, 'PendingVaccines', id), {
    status: 'rejected',
    reviewedBy,
    reviewedAt: isoNow(),
    rejectionReason,
  })
}

// ── Counts (for admin badge) ──────────────────────────────────────────────────

export async function getPendingCounts(): Promise<{
  clinics: number
  practitioners: number
  vaccines: number
  total: number
}> {
  const [c, p, v] = await Promise.all([
    getDocs(query(collection(db, 'PendingClinics'),       where('status', '==', 'pending'))),
    getDocs(query(collection(db, 'PendingPractitioners'), where('status', '==', 'pending'))),
    getDocs(query(collection(db, 'PendingVaccines'),      where('status', '==', 'pending'))),
  ])
  return {
    clinics: c.size,
    practitioners: p.size,
    vaccines: v.size,
    total: c.size + p.size + v.size,
  }
}
