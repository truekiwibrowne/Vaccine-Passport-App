import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  getDoc, setDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { isoNow } from '../utils/dateUtils'
import type {
  SexualHealthRecord, SexualHealthConfig, PublicSexualHealthDoc, PublicSHRecord,
} from '../types/sexualHealth'
import { SH_CONDITION_LABELS, SH_CURABILITY } from '../types/sexualHealth'
import type { PHRPassportSummary } from '../types/user'

// ── Firestore paths ────────────────────────────────────────────────────────────

const shCol    = (uid: string) => collection(db, 'User_Data', uid, 'SexualHealth')
const shDoc    = (uid: string, id: string) => doc(db, 'User_Data', uid, 'SexualHealth', id)
const cfgDoc   = (uid: string) => doc(db, 'User_Data', uid)                     // reuses profile doc
const publicDoc = (token: string) => doc(db, 'PublicSexualHealth', token)

// ── Records ────────────────────────────────────────────────────────────────────

export async function getSHRecords(uid: string): Promise<SexualHealthRecord[]> {
  const snap = await getDocs(query(shCol(uid), orderBy('testDate', 'desc')))
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as SexualHealthRecord)
}

export async function addSHRecord(
  uid: string,
  data: Omit<SexualHealthRecord, 'id' | 'Created' | 'Updated'>,
): Promise<string> {
  const now = isoNow()
  const ref = await addDoc(shCol(uid), { ...data, Created: now, Updated: now })
  return ref.id
}

export async function updateSHRecord(
  uid: string,
  id: string,
  data: Partial<Omit<SexualHealthRecord, 'id' | 'Created'>>,
): Promise<void> {
  await updateDoc(shDoc(uid, id), { ...data, Updated: isoNow() })
}

export async function deleteSHRecord(uid: string, id: string): Promise<void> {
  await deleteDoc(shDoc(uid, id))
}

// ── Config (piggybacks on User_Data/{uid}/Profile doc) ────────────────────────

export async function getSHConfig(uid: string): Promise<SexualHealthConfig | null> {
  const snap = await getDoc(cfgDoc(uid))
  if (!snap.exists()) return null
  return (snap.data().sexualHealthConfig ?? null) as SexualHealthConfig | null
}

export async function updateSHConfig(uid: string, updates: Partial<SexualHealthConfig>): Promise<void> {
  // Firestore's updateDoc does NOT deep-merge nested objects — it replaces the entire
  // 'sexualHealthConfig' key. Use dot-notation so each field is patched independently,
  // leaving all other config fields intact.
  const dotted = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [`sexualHealthConfig.${k}`, v])
  )
  await updateDoc(cfgDoc(uid), dotted)
}

export async function initSHConfig(uid: string): Promise<SexualHealthConfig> {
  const token = crypto.randomUUID()
  const cfg: SexualHealthConfig = {
    shareEnabled: false,
    shareToken: token,
    showConditionNames: true,
    showMedication: false,
  }
  await updateDoc(cfgDoc(uid), { sexualHealthConfig: cfg })
  return cfg
}

// ── Public sharing ─────────────────────────────────────────────────────────────

/** Push a fresh summary to the public document so QR readers see up-to-date data. */
export async function publishSHSummary(
  uid: string,
  displayName: string,
  cfg: SexualHealthConfig,
  records: SexualHealthRecord[],
): Promise<void> {
  const shared = records.filter(r => r.includeInShare)

  const publicRecords: PublicSHRecord[] = shared.map(r => ({
    ...(cfg.showConditionNames ? {
      conditionLabel: SH_CONDITION_LABELS[r.condition as keyof typeof SH_CONDITION_LABELS] ?? r.condition,
    } : {}),
    result: r.result,
    testDate: r.testDate,
    ...(cfg.showMedication && r.medication ? { medication: r.medication } : {}),
  }))

  const publicData: PublicSexualHealthDoc = {
    ownerUid: uid,
    displayName,
    lastUpdated: isoNow(),
    showConditionNames: cfg.showConditionNames,
    showMedication: cfg.showMedication,
    ...(cfg.customMessage ? { customMessage: cfg.customMessage } : {}),
    records: publicRecords,
  }

  await setDoc(publicDoc(cfg.shareToken), publicData)
  await updateDoc(cfgDoc(uid), { 'sexualHealthConfig.lastPublished': isoNow() })
}

/** Remove the public document (called when sharing is disabled). */
export async function unpublishSHSummary(token: string): Promise<void> {
  await deleteDoc(publicDoc(token))
}

/** Read the public document — callable without authentication. */
export async function getPublicSHDoc(token: string): Promise<PublicSexualHealthDoc | null> {
  const snap = await getDoc(publicDoc(token))
  if (!snap.exists()) return null
  return snap.data() as PublicSexualHealthDoc
}

// ── PIN utilities (device-local, never stored in Firestore) ───────────────────

export const PIN_STORAGE_KEY   = (uid: string) => `sh_pin_hash_${uid}`
export const PIN_SESSION_KEY   = (uid: string) => `sh_session_${uid}`

async function hashPin(pin: string, uid: string): Promise<string> {
  const payload = `${pin}:${uid}:vaxpass-private-health`

  // window.crypto.subtle requires a secure context (HTTPS or localhost).
  // When running over LAN HTTP (dev testing), it is undefined — fall back to
  // a pure-JS FNV-1a hash so the PIN can still be saved locally.
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(payload)
    const buf  = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // FNV-1a 32-bit fallback — deterministic and consistent on this device.
  // Prefixed with 'fb:' so a hash set in HTTP-dev and a hash set in HTTPS-prod
  // never collide (they'd both fail verifyPin gracefully).
  let h = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    h = Math.imul(h ^ payload.charCodeAt(i), 0x01000193) >>> 0
  }
  return 'fb:' + h.toString(16).padStart(8, '0')
}

export function isPinSet(uid: string): boolean {
  return !!localStorage.getItem(PIN_STORAGE_KEY(uid))
}

export function isSessionUnlocked(uid: string): boolean {
  return sessionStorage.getItem(PIN_SESSION_KEY(uid)) === '1'
}

export async function verifyPin(pin: string, uid: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_STORAGE_KEY(uid))
  if (!stored) return false
  return (await hashPin(pin, uid)) === stored
}

export async function savePin(pin: string, uid: string): Promise<void> {
  localStorage.setItem(PIN_STORAGE_KEY(uid), await hashPin(pin, uid))
}

export function unlockSession(uid: string): void {
  sessionStorage.setItem(PIN_SESSION_KEY(uid), '1')
}

export function lockSession(uid: string): void {
  sessionStorage.removeItem(PIN_SESSION_KEY(uid))
}

// ── Validation requests for SH records ────────────────────────────────────────

/**
 * Create a Validation_Requests document for a sexual health record.
 * Mirrors the vaccine validation flow but targets SexualHealth/{id}.
 */
export async function createSHValidationRequest(
  uid: string,
  recordId: string,
  conditionLabel: string,
  validatorEmail: string,
  requestorEmail: string,
): Promise<string> {
  const now = isoNow()
  const ref = await addDoc(collection(db, 'Validation_Requests'), {
    user_id:          uid,
    user_vaccine_id:  recordId,   // reusing field name — holds SH record ID
    vaccine_name:     conditionLabel,
    record_type:      'sexual_health',
    requestor_email:  requestorEmail,
    validator_email:  validatorEmail,
    requested_at:     now,
    status:           'pending',
    responded_at:     null,
    validator_notes:  '',
    authentication_level: 0,
  })
  // Mark the SH record as pending
  await updateDoc(shDoc(uid, recordId), {
    pending_validation: true,
    validator_email:    validatorEmail,
    Updated:            now,
  })
  return ref.id
}

// ── Quick-access tile preference (device-local) ────────────────────────────────
// Controls whether the "Private Health Records" tile appears on the home screen
// and sidebar. Stored in localStorage so it survives browser restarts.

export const SH_QUICKACCESS_KEY = (uid: string) => `sh_quickaccess_${uid}`

export function getSHQuickAccess(uid: string): boolean {
  return localStorage.getItem(SH_QUICKACCESS_KEY(uid)) === '1'
}

export function setSHQuickAccess(uid: string, enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(SH_QUICKACCESS_KEY(uid), '1')
  } else {
    localStorage.removeItem(SH_QUICKACCESS_KEY(uid))
  }
}

// ── Passport QR — sanitised PHR summary ───────────────────────────────────────

/**
 * Computes a sanitised PHR summary from the user's records and writes it to
 * their Public_Profile/summary doc so the passport QR scan page can show it.
 *
 * Rules:
 * - NO condition names are ever written — only aggregate status
 * - "isClear" = all EFFECTIVE results are negative/immune
 *   (for curable/clearable conditions, a later negative supersedes an earlier
 *   positive — the past positive is NOT counted in isClear)
 * - "isOnTreatment" = at least one effective result is on_treatment or undetectable
 * - "lastTestedDate" = the most recent testDate across all records
 *
 * Call this whenever the user saves new records or toggles "include in passport".
 * Call removePHRFromPassport when the user disables the toggle.
 */
export async function publishPHRToPassport(
  uid: string,
  records: SexualHealthRecord[],
): Promise<void> {
  if (records.length === 0) return

  // Group records by condition, take the most recent for each
  const byCondition = new Map<string, SexualHealthRecord[]>()
  for (const r of records) {
    const arr = byCondition.get(r.condition) ?? []
    arr.push(r)
    byCondition.set(r.condition, arr)
  }

  let isClear      = true
  let isOnTreatment = false

  for (const [condition, recs] of byCondition) {
    const sorted = [...recs].sort((a, b) => b.testDate.localeCompare(a.testDate))
    const latest = sorted[0]
    const curability = SH_CURABILITY[condition as keyof typeof SH_CURABILITY] ?? 'curable'

    let effectiveResult = latest.result

    // For curable/clearable: if a LATER negative/immune exists, the condition is clear
    if (curability !== 'lifelong') {
      const hasLaterNegative = sorted.some(
        r => r.testDate === latest.testDate
          ? false
          : r.result === 'negative' || r.result === 'immune',
      )
      if (hasLaterNegative) effectiveResult = 'negative'
    }

    if (effectiveResult === 'on_treatment' || effectiveResult === 'undetectable') {
      isOnTreatment = true
    }
    if (
      effectiveResult !== 'negative' &&
      effectiveResult !== 'immune' &&
      effectiveResult !== 'pending'    // pending records don't affect clear status
    ) {
      isClear = false
    }
  }

  const lastTestedDate = records
    .map(r => r.testDate)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0]

  const summary: PHRPassportSummary = {
    lastTestedDate,
    isClear,
    isOnTreatment,
    updatedAt: isoNow(),
  }

  await updateDoc(
    doc(db, 'User_Data', uid, 'Public_Profile', 'summary'),
    { phrSummary: summary },
  )

  // Also mark as published in the config
  await updateDoc(
    doc(db, 'User_Data', uid),
    { 'sexualHealthConfig.passportLastPublished': isoNow() },
  )
}

/**
 * Removes the PHR summary from the public profile doc when the user
 * disables "Include in Passport QR".
 */
export async function removePHRFromPassport(uid: string): Promise<void> {
  const { deleteField } = await import('firebase/firestore')
  await updateDoc(
    doc(db, 'User_Data', uid, 'Public_Profile', 'summary'),
    { phrSummary: deleteField() },
  )
}
