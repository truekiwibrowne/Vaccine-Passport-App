/**
 * notifier/expiry-reminders.js
 *
 * Runs via GitHub Actions daily at 08:00 UTC.
 * For every user who has push notifications enabled, checks all their
 * vaccines (personal, dependents, pets, farm animals) and sends a
 * push notification at the 30-day and 7-day marks before expiry.
 *
 * Duplicate-send prevention: writes a doc to Expiry_Reminder_Log
 * whose ID is uid_vaccineId_Nday — if the doc exists, skip.
 *
 * Required GitHub Actions secret:
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore }         from 'firebase-admin/firestore'
import { getMessaging }         from 'firebase-admin/messaging'

// ── Firebase init ─────────────────────────────────────────────────────────────

const envJson = process.env.FIREBASE_SERVICE_ACCOUNT
if (!envJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT env var is not set.')
  process.exit(1)
}
const serviceAccount = JSON.parse(Buffer.from(envJson, 'base64').toString('utf8'))
initializeApp({ credential: cert(serviceAccount) })

const db        = getFirestore()
const messaging = getMessaging()

// ── Constants ─────────────────────────────────────────────────────────────────

const REMINDER_DAYS = [30, 7]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpiringIn(expiryDateStr, targetDays) {
  if (!expiryDateStr) return false
  const msPerDay = 1000 * 60 * 60 * 24
  const diff = Math.round((new Date(expiryDateStr) - Date.now()) / msPerDay)
  return diff >= targetDays - 1 && diff <= targetDays + 1
}

function fmtDate(isoStr) {
  try {
    return new Date(isoStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return isoStr }
}

async function alreadySent(uid, vaccineId, days) {
  const id = `${uid}_${vaccineId}_${days}day`
  return (await db.collection('Expiry_Reminder_Log').doc(id).get()).exists
}

async function markSent(uid, vaccineId, days) {
  const id = `${uid}_${vaccineId}_${days}day`
  await db.collection('Expiry_Reminder_Log').doc(id).set({
    uid, vaccineId, days, sentAt: new Date().toISOString(),
  })
}

async function sendPush(token, title, body) {
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: { url: '/vaccines' },
      webpush: { fcmOptions: { link: '/vaccines' } },
    })
    return true
  } catch (e) {
    console.warn(`  FCM send failed (stale token?): ${e.message}`)
    return false
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Vaccine Notifier — expiry-reminders — ${new Date().toISOString()}`)
  console.log(`${'═'.repeat(60)}\n`)

  const tokenSnap = await db.collection('FCM_Tokens').get()
  if (tokenSnap.empty) {
    console.log('No registered FCM tokens — nothing to do.')
    return
  }

  let totalSent = 0

  for (const tokenDoc of tokenSnap.docs) {
    const { uid, token } = tokenDoc.data()
    if (!uid || !token) continue
    console.log(`\nChecking vaccines for uid: ${uid}`)

    // ── 1. Personal vaccines ─────────────────────────────────────────────────
    const personalSnap = await db
      .collection('User_Data').doc(uid).collection('Vaccines').get()

    for (const vacDoc of personalSnap.docs) {
      const vax = vacDoc.data()
      if (!vax.Expiration_date) continue
      for (const days of REMINDER_DAYS) {
        if (!isExpiringIn(vax.Expiration_date, days)) continue
        if (await alreadySent(uid, vacDoc.id, days)) continue
        const ok = await sendPush(
          token,
          `💉 Vaccine expiring in ${days} days`,
          `Your ${vax.vaccine_name} expires on ${fmtDate(vax.Expiration_date)}. Renew it soon.`,
        )
        if (ok) { await markSent(uid, vacDoc.id, days); totalSent++; console.log(`  ✓ ${vax.vaccine_name} (${days}d)`) }
      }
    }

    // ── 2. Dependents ────────────────────────────────────────────────────────
    const depSnap = await db.collection('Dependents')
      .where('members', 'array-contains', uid).get()

    for (const depDoc of depSnap.docs) {
      const depName = depDoc.data().name || 'Your dependent'
      const vaxSnap = await db.collection('Dependents').doc(depDoc.id).collection('Vaccines').get()
      for (const vacDoc of vaxSnap.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(uid, vacDoc.id, days)) continue
          const ok = await sendPush(
            token,
            `👶 ${depName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${depName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (ok) { await markSent(uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Dep(${depName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }

    // ── 3. Pets ──────────────────────────────────────────────────────────────
    const petSnap = await db.collection('Pets')
      .where('members', 'array-contains', uid).get()

    for (const petDoc of petSnap.docs) {
      const petName = petDoc.data().name || 'Your pet'
      const vaxSnap = await db.collection('Pets').doc(petDoc.id).collection('Vaccines').get()
      for (const vacDoc of vaxSnap.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(uid, vacDoc.id, days)) continue
          const ok = await sendPush(
            token,
            `🐾 ${petName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${petName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (ok) { await markSent(uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Pet(${petName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }

    // ── 4. Farm animals ──────────────────────────────────────────────────────
    const farmSnap = await db.collection('FarmAnimals')
      .where('members', 'array-contains', uid).get()

    for (const farmDoc of farmSnap.docs) {
      const animal = farmDoc.data()
      const animalName = animal.name || animal.tag || 'Your animal'
      const vaxSnap = await db.collection('FarmAnimals').doc(farmDoc.id).collection('Vaccines').get()
      for (const vacDoc of vaxSnap.docs) {
        const vax = vacDoc.data()
        if (!vax.Expiration_date) continue
        for (const days of REMINDER_DAYS) {
          if (!isExpiringIn(vax.Expiration_date, days)) continue
          if (await alreadySent(uid, vacDoc.id, days)) continue
          const ok = await sendPush(
            token,
            `🐄 ${animalName}'s vaccine expiring in ${days} days`,
            `${vax.vaccine_name} for ${animalName} expires on ${fmtDate(vax.Expiration_date)}.`,
          )
          if (ok) { await markSent(uid, vacDoc.id, days); totalSent++; console.log(`  ✓ Farm(${animalName}): ${vax.vaccine_name} (${days}d)`) }
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Done  |  ${totalSent} expiry reminder(s) sent`)
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Fatal error:', e); process.exit(1) })
