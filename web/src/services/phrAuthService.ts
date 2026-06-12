/**
 * Cross-device PIN setup authorisation for Private Health Records.
 *
 * Flow:
 *   1. Requesting device (e.g. phone, no PIN set) calls `requestPHRAccess`.
 *   2. Approving device (e.g. desktop, already signed in) sees the pending
 *      request via `listenForPendingPHRRequests` and calls `approvePHRRequest`.
 *   3. Requesting device is watching via `listenForPHRApproval` and gets the
 *      'approved' signal — it then allows a one-time PIN setup window.
 *
 * The PIN itself is NEVER stored in Firestore. Only a short-lived status flag
 * is written. Requests expire automatically after 5 minutes.
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PHRAuthRequest {
  id: string
  status: 'pending' | 'approved' | 'denied'
  requestedAt: string        // ISO
  expiresAt: string          // ISO — 5 min from requestedAt
  deviceHint: string         // e.g. "Safari on iPhone"
  requestingDeviceId: string // stable random ID stored in localStorage on the requesting device
}

// ── Firestore path ─────────────────────────────────────────────────────────────

const reqCol = (uid: string) =>
  collection(db, 'User_Data', uid, 'PHR_Auth_Requests')

const reqDoc = (uid: string, id: string) =>
  doc(db, 'User_Data', uid, 'PHR_Auth_Requests', id)

// ── Helpers ────────────────────────────────────────────────────────────────────

function deviceHint(): string {
  const ua = navigator.userAgent
  const os =
    /iPhone|iPad/.test(ua) ? 'iPhone' :
    /Android/.test(ua)     ? 'Android' :
    /Mac/.test(ua)         ? 'Mac' :
    /Windows/.test(ua)     ? 'Windows' : 'Device'
  const browser =
    /CriOS|Chrome/.test(ua) ? 'Chrome' :
    /FxiOS|Firefox/.test(ua) ? 'Firefox' :
    /Safari/.test(ua)        ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

const DEVICE_ID_KEY = 'vaxpass_device_id'

/**
 * Returns a stable, random device ID stored in localStorage.
 * Used to identify which device sent a PHR auth request so the requesting
 * device can suppress its own banner.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    // Generate a random ID without SubtleCrypto (works on HTTP too)
    id = Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Called by the requesting device (phone) to create a pending auth request.
 * Returns the new document ID.
 */
export async function requestPHRAccess(uid: string): Promise<string> {
  const now = new Date()
  const expires = new Date(now.getTime() + 5 * 60 * 1000)   // +5 min

  const ref = await addDoc(reqCol(uid), {
    status: 'pending',
    requestedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    deviceHint: deviceHint(),
    requestingDeviceId: getDeviceId(),
  })
  return ref.id
}

/**
 * Called by the approving device (desktop). Updates status to 'approved'.
 */
export async function approvePHRRequest(uid: string, requestId: string): Promise<void> {
  await updateDoc(reqDoc(uid, requestId), { status: 'approved' })
}

/**
 * Called by the approving device when they deny a request.
 */
export async function denyPHRRequest(uid: string, requestId: string): Promise<void> {
  await updateDoc(reqDoc(uid, requestId), { status: 'denied' })
}

/**
 * Cleans up an auth request after it's been acted on.
 */
export async function deletePHRRequest(uid: string, requestId: string): Promise<void> {
  await deleteDoc(reqDoc(uid, requestId))
}

/**
 * Real-time listener used by the REQUESTING device.
 * Calls `onUpdate` whenever the request document changes.
 * Returns an unsubscribe function.
 */
export function listenForPHRApproval(
  uid: string,
  requestId: string,
  onUpdate: (req: PHRAuthRequest | null) => void,
): () => void {
  return onSnapshot(
    reqDoc(uid, requestId),
    snap => {
      if (!snap.exists()) { onUpdate(null); return }
      onUpdate({ id: snap.id, ...snap.data() } as PHRAuthRequest)
    },
    err => {
      console.error('[PHRApproval] listener error:', err)
      onUpdate(null)
    },
  )
}

/**
 * Real-time listener used by the APPROVING device.
 * Returns all pending, non-expired requests for the user.
 * Calls `onUpdate` whenever the list changes.
 * Returns an unsubscribe function.
 */
export function listenForPendingPHRRequests(
  uid: string,
  onUpdate: (requests: PHRAuthRequest[]) => void,
): () => void {
  // No orderBy — avoids requiring a composite index. There are typically
  // only 1–2 pending requests at a time so client-side sort is fine.
  const q = query(reqCol(uid), where('status', '==', 'pending'))
  return onSnapshot(
    q,
    snap => {
      const now = new Date()
      const live = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as PHRAuthRequest)
        .filter(r => new Date(r.expiresAt) > now)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      onUpdate(live)
    },
    err => {
      console.error('[PHRApprovalBanner] Firestore listener error:', err)
    },
  )
}

/** Returns true if a request has not yet expired. */
export function isPHRRequestValid(req: PHRAuthRequest): boolean {
  return new Date(req.expiresAt) > new Date()
}

/** Formats a countdown string like "4:32" from an expiry ISO timestamp. */
export function phrRequestSecondsRemaining(req: PHRAuthRequest): number {
  return Math.max(0, Math.floor((new Date(req.expiresAt).getTime() - Date.now()) / 1000))
}
