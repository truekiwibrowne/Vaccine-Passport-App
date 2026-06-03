import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { NewsFeedPost, SponsoredContent } from '../types/newsFeed'
import type { NotificationTarget } from '../types/admin'
import type { UserVaccine } from '../types/vaccine'

// ── Collections ────────────────────────────────────────────────────────────────

const NEWS_COL = 'News_Feed'
const SPONSORED_COL = 'Sponsored_Content'

// ── News Feed ─────────────────────────────────────────────────────────────────

export async function getActiveNewsPosts(): Promise<NewsFeedPost[]> {
  // Avoid composite index requirement by fetching all and filtering client-side.
  const snap = await getDocs(collection(db, NEWS_COL))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as NewsFeedPost)
    .filter(p => p.status === 'active')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

export async function getAllNewsPosts(): Promise<NewsFeedPost[]> {
  const snap = await getDocs(collection(db, NEWS_COL))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as NewsFeedPost)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

export async function getPendingNewsPosts(): Promise<NewsFeedPost[]> {
  const snap = await getDocs(collection(db, NEWS_COL))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as NewsFeedPost)
    .filter(p => p.status === 'pending')
    .sort((a, b) => (b.crawledAt ?? b.createdAt ?? '').localeCompare(a.crawledAt ?? a.createdAt ?? ''))
}

export async function createNewsPost(
  data: Omit<NewsFeedPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, NEWS_COL), { ...data, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateNewsPost(id: string, data: Partial<Omit<NewsFeedPost, 'id'>>): Promise<void> {
  await updateDoc(doc(db, NEWS_COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteNewsPost(id: string): Promise<void> {
  await deleteDoc(doc(db, NEWS_COL, id))
}

// ── Sponsored Content ─────────────────────────────────────────────────────────

export async function getActiveSponsoredContent(): Promise<SponsoredContent[]> {
  // Avoid composite index requirement by fetching all and filtering client-side.
  const snap = await getDocs(collection(db, SPONSORED_COL))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as SponsoredContent)
    .filter(s => s.status === 'active')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export async function getAllSponsoredContent(): Promise<SponsoredContent[]> {
  const snap = await getDocs(collection(db, SPONSORED_COL))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as SponsoredContent)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export async function createSponsoredContent(
  data: Omit<SponsoredContent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, SPONSORED_COL), { ...data, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateSponsoredContent(id: string, data: Partial<Omit<SponsoredContent, 'id'>>): Promise<void> {
  await updateDoc(doc(db, SPONSORED_COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteSponsoredContent(id: string): Promise<void> {
  await deleteDoc(doc(db, SPONSORED_COL, id))
}

// ── Client-side targeting filter ──────────────────────────────────────────────
// Mirrors the server-side checkRule in process-notifications.mjs.
// Used to filter posts/sponsored content before rendering on the dashboard.

interface UserProfile {
  Passport_Issuing_Country?: string
  travelDestination?: string
  gender?: string
  biologicalSex?: string
  Date_of_Birth?: string
}

function checkRule(rule: NotificationTarget, profile: UserProfile, vaccines: UserVaccine[]): boolean {
  switch (rule.type) {
    case 'all': return true

    case 'location': {
      const country = profile.Passport_Issuing_Country || profile.travelDestination || ''
      return rule.countries?.some(c => c.toUpperCase() === country.toUpperCase()) ?? false
    }

    case 'gender':
      return (profile.gender || '').toLowerCase() === rule.value.toLowerCase()

    case 'biologicalSex':
      return (profile.biologicalSex || '').toLowerCase() === rule.value.toLowerCase()

    case 'ageRange': {
      if (!profile.Date_of_Birth) return false
      const age = new Date().getFullYear() - new Date(profile.Date_of_Birth).getFullYear()
      if (rule.minAge != null && age < rule.minAge) return false
      if (rule.maxAge != null && age > rule.maxAge) return false
      return true
    }

    case 'hasVaccine': {
      const name = (rule.vaccineName || '').toLowerCase()
      return vaccines.some(v => v.vaccine_name?.toLowerCase().includes(name))
    }

    case 'missingVaccine': {
      const name = (rule.vaccineName || '').toLowerCase()
      return !vaccines.some(v => v.vaccine_name?.toLowerCase().includes(name))
    }

    default: return true
  }
}

export function matchesTargets(
  targets: NotificationTarget[],
  profile: UserProfile,
  vaccines: UserVaccine[]
): boolean {
  if (!targets || targets.length === 0) return true
  if (targets.some(t => t.type === 'all')) return true
  return targets.every(t => checkRule(t, profile, vaccines))
}
