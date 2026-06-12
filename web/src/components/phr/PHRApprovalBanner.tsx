/**
 * PHRApprovalBanner — floats at the top of the app on the APPROVING device.
 *
 * Mounts globally inside AppLayout. Shows whenever another signed-in session
 * (e.g. phone) requests permission to set up a Private Health PIN.
 *
 * Security: only shows to users who are already authenticated AND whose session
 * is currently unlocked for PHR (i.e. they've already entered their PIN on this
 * device, OR no PIN is set and they're approving for a new device).
 *
 * Actually: we show the approval banner to the DESKTOP session regardless of
 * whether PHR is unlocked there — the act of being logged in on this trusted
 * device is the authorisation. The user is shown what device is requesting,
 * and can approve or deny.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listenForPendingPHRRequests,
  approvePHRRequest,
  denyPHRRequest,
  deletePHRRequest,
  phrRequestSecondsRemaining,
  getDeviceId,
} from '../../services/phrAuthService'
import type { PHRAuthRequest } from '../../services/phrAuthService'

export function PHRApprovalBanner() {
  const { user } = useAuth()
  const [requests, setRequests]   = useState<PHRAuthRequest[]>([])
  const [acting, setActing]       = useState<string | null>(null)     // id being acted on
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())  // locally dismissed

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const unsub = listenForPendingPHRRequests(user.uid, setRequests)
    return unsub
  }, [user])

  // ── Countdown ticker — clears requests that have expired client-side ──────
  useEffect(() => {
    if (requests.length === 0) return
    const id = setInterval(() => {
      setRequests(prev => prev.filter(r => phrRequestSecondsRemaining(r) > 0))
    }, 1000)
    return () => clearInterval(id)
  }, [requests.length])

  // Never show the banner for requests that originated from THIS device —
  // only the APPROVING device should see them.
  const thisDeviceId = getDeviceId()
  const visible = requests.filter(r => !dismissed.has(r.id) && r.requestingDeviceId !== thisDeviceId)
  if (!user || visible.length === 0) return null

  const req = visible[0]     // show one at a time; extras queue behind
  const secs = phrRequestSecondsRemaining(req)
  const mm = String(Math.floor(secs / 60)).padStart(1, '0')
  const ss = String(secs % 60).padStart(2, '0')

  async function handleApprove() {
    setActing(req.id)
    try {
      await approvePHRRequest(user!.uid, req.id)
      // Clean up after a short delay so the requesting device's listener fires
      setTimeout(() => deletePHRRequest(user!.uid, req.id), 8000)
      setDismissed(prev => new Set(prev).add(req.id))
    } finally {
      setActing(null)
    }
  }

  async function handleDeny() {
    setActing(req.id)
    try {
      await denyPHRRequest(user!.uid, req.id)
      setTimeout(() => deletePHRRequest(user!.uid, req.id), 4000)
      setDismissed(prev => new Set(prev).add(req.id))
    } finally {
      setActing(null)
    }
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4"
      role="alertdialog"
      aria-label="Private Health PIN setup request"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-violet-100 dark:border-violet-800 overflow-hidden">
        {/* Coloured top bar */}
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />

        <div className="px-4 py-4">
          {/* Icon + heading */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                Private Health PIN Setup Request
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-medium text-violet-600 dark:text-violet-400">{req.deviceHint}</span>
                {' '}is requesting permission to create a new PIN for your Private Health Records.
              </p>
            </div>
          </div>

          {/* Timer */}
          <div className="mt-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-400">
              Request expires in <span className={`font-semibold tabular-nums ${secs < 60 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>{mm}:{ss}</span>
            </p>
            {visible.length > 1 && (
              <span className="ml-auto text-[10px] text-gray-400">+{visible.length - 1} more</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleDeny}
              disabled={!!acting}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={!!acting}
              className="flex-2 flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {acting === req.id ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 text-center leading-snug">
            Only approve if you're setting up this app on your own device.
            Your PIN is stored locally — it will never be uploaded.
          </p>
        </div>
      </div>
    </div>
  )
}
