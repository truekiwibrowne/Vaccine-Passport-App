/**
 * diseaseRiskService — Firestore CRUD for Disease_Risk collection.
 *
 * Each document is keyed by the vaccine library entry ID so the link is exact
 * (no fuzzy disease-name matching needed at read time).
 *
 * Collection:  Disease_Risk
 * Document ID: Vaccine_Library entry ID
 * Fields:
 *   diseaseTarget  string    — label shown in the map header (mirrors entry['Disease Target'])
 *   high           string[]  — country names with high endemic / required-vaccination risk
 *   medium         string[]  — country names with moderate / recommended risk
 *   note           string    — optional contextual callout (eradication status, no-vaccine, etc.)
 *   updatedAt      string    — ISO timestamp of last admin edit
 */
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface DiseaseRiskDoc {
  diseaseTarget: string
  high:   string[]
  medium: string[]
  note:   string
  updatedAt?: string
}

const COLLECTION = 'Disease_Risk'

/** Fetch the risk data for a vaccine library entry. Returns null if not found. */
export async function getDiseaseRisk(entryId: string): Promise<DiseaseRiskDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, entryId))
  if (!snap.exists()) return null
  return snap.data() as DiseaseRiskDoc
}

/** Create or overwrite the risk data for a vaccine library entry. */
export async function setDiseaseRisk(entryId: string, data: DiseaseRiskDoc): Promise<void> {
  await setDoc(doc(db, COLLECTION, entryId), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

/** Remove risk data for a vaccine library entry (admin-only). */
export async function deleteDiseaseRisk(entryId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, entryId))
}
