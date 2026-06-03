/**
 * Netlify Scheduled Function — expiry-reminders
 * Runs daily at 08:00 UTC.
 *
 * Checks every registered device's vaccines (personal, dependents, pets,
 * farm animals) and sends push notifications at the 30-day and 7-day marks
 * before expiry. Duplicate-send prevention is handled by writing a doc to
 * the Expiry_Reminder_Log collection (doc ID = uid_vaccineId_Nday).
 *
 * Required env var (same as the other functions):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full JSON of the service account key
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                   from 'firebase-admin/firestore'
import { getMessaging }                   from 'firebase-admin/messaging'

export const config = { schedule: '0 8 * * *' }

// ── Days before expiry at which we fire a reminder ───────────────────────────
const REMINDER_DAYS = [30, 7]

// ── Helpers ───────────────────────────────────────────────────────────────────

function initAdmin() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set')
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(sa)) })
}

/**
 * Return true if the expiry date falls within [targetDays-1, targetDays+1] days
 * from today (±1 day tolerance so a daily job never misses a window).
 */
function isExpiringIn(expiryDateStr, targetDays) {
  if (!expiryDateStr) return false
  const msPerDay = 1000 * 60 * 60 * 24
  const diff = Math.round((new Date(expiryDateStr) - Date.now()) / msPerDay)
  return diff >= targetDays - 1 && diff <= targetDays + 1
}

function fmtDate(isoStr) {
  try { return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return isoStr }
}

async function alreadySent(db, uid, vaccineId, days) {
  const id = `${uid}_${vaccineId}_${days}day`
  return (await db.collection('Expiry_Reminder_Log').doc(id).get()).exists
}

async function markSent(db, uid, vaccineId, days) {
  const id = `${uid}_${vaccineId}_${days}day`
  await db.collection('Expiry_Reminder_Log').doc(id).set({
    uid, vaccineId, days, sentAt: new Date().toISOString(),
  })
}

async function sendPush(messaging, token, title, body, urlPath = '/vaccines') {
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: { url: urlPath },
      webpush: { fcmOptions: { link: urlPath } },
    })
    return true
  } catch (e) {
    // Token may be stale — log but don't crash
    console.warn(`  FCM send failed: ${e.message}`)
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler() {
  try { initAdmin() }
  catch (e) {
    console.error(e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 503 })
  }

  const db        = getFirestore()
  const messaging = getMessaging()

  // All users who have enabled push notifications
  const tokenSnap = await db.collection('FCM_Tokens').get()
  if (tokenSnap.empty) {
    console.log('[expiry-reminders] No registered FCM tokens — nothing to do.')
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  let totalSent = 0
  const now = new Date().toISOString()

  for (const tokenDoc of tokenSnap.docs) {
    const { uid, token } = tokenDoc.data()
    if (!uid || !token) continue

    console.log(`\nChecking vaccines for uid: ${uid}`)

    // ── 1. Personal vaccines ───────────────────────────────────────────────
    const personalVax = await db.collection('User_Data').doc(uid).collection('Vaccines').get()
    for (const vacDoc of personalVax.docs) {
      const vax = vacDoc.data()
      if (!vax.Expiration_date) continue
      for (const days of REMINDER_DAYS) {
        if (!isExpiringIn(vax.Expiration_date, days)) continue
        if (await alreadySent(db, uid, vacDoc.id, days)) continue
        const sent = await sendPush(
          messaging, token,
          `💉 Vaccine expiring in ${days} days`,
          `Your ${vax.vaccine_name} expires on ${fmtDate(vax.Expiration_date)}. Renew it soon.`,
        )
        if (sent) { await markSent(db, uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Personal: ${vax.vaccine_name} (${days}d)`) }
      }
    }

    // ── 2. Dependent vaccines ──────────────────────────────────────────────
    const depDocs = await db.collection('Dependents').where('members', 'array-contains', uid).get()
    for (const depDoc of depDocs.docs) {
      const dep = depDoc.data()
      const depName = dep.name || 'Your dependent'
      const depVax  = await db.collection('Dependents').doc(depDoc.id).collection('Vaccines').get()
      for (const vacDoc of depVax.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(db, uid, vacDoc.id, days)) continue
          const sent = await sendPush(
            messaging, token,
            `👶 ${depName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${depName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (sent) { await markSent(db, uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Dep (${depName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }

    // ── 3. Pet vaccines ────────────────────────────────────────────────────
    const petDocs = await db.collection('Pets').where('members', 'array-contains', uid).get()
    for (const petDoc of petDocs.docs) {
      const pet    = petDoc.data()
      const petName = pet.name || 'Your pet'
      const petVax  = await db.collection('Pets').doc(petDoc.id).collection('Vaccines').get()
      for (const vacDoc of petVax.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(db, uid, vacDoc.id, days)) continue
          const sent = await sendPush(
            messaging, token,
            `🐾 ${petName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${petName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (sent) { await markSent(db, uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Pet (${petName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }

    // ── 4. Farm animal vaccines ────────────────────────────────────────────
    const farmDocs = await db.collection('FarmAnimals').where('members', 'array-contains', uid).get()
    for (const farmDoc of farmDocs.docs) {
      const animal     = farmDoc.data()
      const animalName = animal.name || animal.tag || 'Your animal'
      const farmVax    = await db.collection('FarmAnimals').doc(farmDoc.id).collection('Vaccines').get()
      for (const vacDoc of farmVax.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(db, uid, vacDoc.id, days)) continue
          const sent = await sendPush(
            messaging, token,
            `🐄 ${animalName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${animalName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (sent) { await markSent(db, uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Farm (${animalName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }
  }

  console.log(`\n[expiry-reminders] Done — ${totalSent} reminder(s) sent at ${now}`)
  return new Response(JSON.stringify({ sent: totalSent }), { status: 200 })
}
