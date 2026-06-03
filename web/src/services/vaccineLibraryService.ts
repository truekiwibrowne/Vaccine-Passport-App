import { collection, getDocs, doc, getDoc, addDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'

let cachedLibrary: VaccineLibraryEntry[] | null = null

export async function getAllVaccineLibraryEntries(): Promise<VaccineLibraryEntry[]> {
  if (cachedLibrary) return cachedLibrary
  const snap = await getDocs(collection(db, 'Vaccine_Library'))
  cachedLibrary = snap.docs.map(d => ({ ...d.data(), id: d.id }) as VaccineLibraryEntry)
  return cachedLibrary
}

export async function getVaccineLibraryEntry(id: string): Promise<VaccineLibraryEntry | null> {
  const snap = await getDoc(doc(db, 'Vaccine_Library', id))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as VaccineLibraryEntry) : null
}

export function clearVaccineLibraryCache() {
  cachedLibrary = null
}

export async function addVaccineLibraryEntry(data: Omit<VaccineLibraryEntry, 'id' | 'relevanceScore'>): Promise<string> {
  const ref = await addDoc(collection(db, 'Vaccine_Library'), data)
  clearVaccineLibraryCache()
  return ref.id
}

export async function updateVaccineLibraryEntry(id: string, data: Partial<Omit<VaccineLibraryEntry, 'id' | 'relevanceScore'>>): Promise<void> {
  await setDoc(doc(db, 'Vaccine_Library', id), data, { merge: true })
  clearVaccineLibraryCache()
}

/**
 * Bulk upsert vaccine library entries from a parsed CSV.
 * - Rows with a valid existing `id` are merged (updated) via setDoc merge.
 * - Rows without an `id` (or an unknown one) are inserted as new documents.
 * Writes are batched in chunks of 499 to stay under Firestore's 500-op limit.
 */
export async function bulkUpsertVaccineLibraryEntries(
  rows: Array<Partial<VaccineLibraryEntry>>,
): Promise<{ added: number; updated: number }> {
  const CHUNK = 499
  let added = 0
  let updated = 0

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const batch = writeBatch(db)

    for (const row of chunk) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, relevanceScore, ...data } = row as VaccineLibraryEntry
      if (id) {
        batch.set(doc(db, 'Vaccine_Library', id), data, { merge: true })
        updated++
      } else {
        batch.set(doc(collection(db, 'Vaccine_Library')), data)
        added++
      }
    }

    await batch.commit()
  }

  clearVaccineLibraryCache()
  return { added, updated }
}

export function searchLibrary(entries: VaccineLibraryEntry[], query: string): VaccineLibraryEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return entries
  return entries.filter(e =>
    e.Vac_Name?.toLowerCase().includes(q) ||
    e['Disease Target']?.toLowerCase().includes(q) ||
    e['Brand Name']?.toLowerCase().includes(q) ||
    e.Manufacturer?.toLowerCase().includes(q)
  )
}
