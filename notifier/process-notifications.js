/**
 * notifier/process-notifications.js
 *
 * Runs via GitHub Actions on a schedule (every 30 minutes).
 * Two jobs in one pass:
 *
 *   A) Custom scheduled notifications
 *      Query Scheduled_Notifications where status='scheduled' and scheduledAt <= now.
 *      Match users to targeting rules, send FCM, mark as 'sent'.
 *
 *   B) News post push notifications
 *      Query News_Feed where status='active' and pushSent != true.
 *      Send to targeted users, mark pushSent: true so it never re-fires.
 *
 * Required GitHub Actions secret:
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 *   (same secret used by the vaccine news crawler)
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

// ── Targeting rule evaluator ──────────────────────────────────────────────────

function checkRule(rule, user) {
  switch (rule.type) {
    case 'all': return true

    case 'location': {
      const country = user.Passport_Issuing_Country || user.currentCountry || user.travelDestination || ''
      return rule.countries?.some(c => c.toUpperCase() === country.toUpperCase()) ?? false
    }

    case 'gender':
      return (user.gender || '').toLowerCase() === (rule.value || '').toLowerCase()

    case 'biologicalSex':
      return (user.biologicalSex || '').toLowerCase() === (rule.value || '').toLowerCase()

    case 'ageRange': {
      if (!user.Date_of_Birth) return false
      const age = new Date().getFullYear() - new Date(user.Date_of_Birth).getFullYear()
      if (rule.minAge != null && age < rule.minAge) return false
      if (rule.maxAge != null && age > rule.maxAge) return false
      return true
    }

    case 'hasVaccine':
    case 'missingVaccine': {
      const vaccines = user.vaccine_names || []
      const hasIt = vaccines.some(n => n.toLowerCase().includes((rule.vaccineName || '').toLowerCase()))
      return rule.type === 'hasVaccine' ? hasIt : !hasIt
    }

    default: return true
  }
}

async function getMatchingTokens(targets) {
  const tokenSnap = await db.collection('FCM_Tokens').get()
  if (targets.some(t => t.type === 'all')) {
    return tokenSnap.docs.map(d => d.data().token).filter(Boolean)
  }
  const matching = []
  for (const tokenDoc of tokenSnap.docs) {
    const { token, uid } = tokenDoc.data()
    if (!token || !uid) continue
    try {
      const userSnap = await db.collection('User_Data').doc(uid).get()
      if (!userSnap.exists) continue
      const user = userSnap.data()
      if (targets.every(rule => checkRule(rule, user))) matching.push(token)
    } catch { /* stale token doc — skip */ }
  }
  return matching
}

async function sendBatched(tokens, notification, data) {
  let sent = 0, failed = 0
  const BATCH = 500
  for (let i = 0; i < tokens.length; i += BATCH) {
    const result = await messaging.sendEachForMulticast({
      tokens: tokens.slice(i, i + BATCH),
      notification,
      data,
      webpush: data.url ? { fcmOptions: { link: data.url } } : undefined,
    })
    sent   += result.successCount
    failed += result.failureCount
  }
  return { sent, failed }
}

// ── A: Custom scheduled notifications ────────────────────────────────────────

async function processScheduledNotifications() {
  const now = new Date().toISOString()
  const snap = await db.collection('Scheduled_Notifications')
    .where('status', '==', 'scheduled')
    .where('scheduledAt', '<=', now)
    .get()

  if (snap.empty) { console.log('[scheduled] Nothing due.'); return 0 }

  let processed = 0
  for (const notifDoc of snap.docs) {
    const notif = notifDoc.data()
    console.log(`[scheduled] Sending: "${notif.title}"`)
    try {
      await notifDoc.ref.update({ status: 'sending' })
      const tokens = await getMatchingTokens(notif.targets || [{ type: 'all' }])
      const { sent, failed } = tokens.length > 0
        ? await sendBatched(tokens,
            { title: notif.title, body: notif.body, imageUrl: notif.imageUrl || undefined },
            notif.actionUrl ? { url: notif.actionUrl } : {})
        : { sent: 0, failed: 0 }

      await notifDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString(), sentCount: sent, failedCount: failed })
      console.log(`  → ${sent} sent, ${failed} failed`)
      processed++
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
      await notifDoc.ref.update({ status: 'failed' }).catch(() => {})
    }
  }
  return processed
}

// ── B: News post push notifications ──────────────────────────────────────────

async function processNewsPushes() {
  // Firestore can't do "field does not exist OR field == false" in one query,
  // so we run two queries and deduplicate by document ID.
  const [explicitFalse, missing] = await Promise.all([
    db.collection('News_Feed').where('status', '==', 'active').where('pushSent', '==', false).get(),
    db.collection('News_Feed').where('status', '==', 'active').where('pushSent', 'not-in', [true, false]).get(),
  ])

  const seenIds = new Set()
  const docs = [...explicitFalse.docs, ...missing.docs].filter(d => {
    if (seenIds.has(d.id)) return false
    seenIds.add(d.id)
    return true
  })

  if (docs.length === 0) { console.log('[news] No unsent news posts.'); return 0 }

  let processed = 0
  for (const newsDoc of docs) {
    const post = newsDoc.data()
    console.log(`[news] Pushing: "${post.title?.slice(0, 60)}"`)
    try {
      const tokens = await getMatchingTokens(post.targets || [{ type: 'all' }])
      const title  = post.badge ? `[${post.badge}] ${post.title}` : post.title
      const { sent, failed } = tokens.length > 0
        ? await sendBatched(tokens,
            { title, body: (post.body || '').slice(0, 200), imageUrl: post.imageUrl || undefined },
            post.actionUrl ? { url: post.actionUrl } : {})
        : { sent: 0, failed: 0 }

      await newsDoc.ref.update({ pushSent: true, pushSentAt: new Date().toISOString(), pushSentCount: sent })
      console.log(`  → ${sent} sent, ${failed} failed`)
      processed++
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
    }
  }
  return processed
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Vaccine Notifier — process-notifications — ${new Date().toISOString()}`)
  console.log(`${'═'.repeat(60)}\n`)

  const [a, b] = await Promise.all([
    processScheduledNotifications(),
    processNewsPushes(),
  ])

  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Done  |  scheduled: ${a}  |  news: ${b}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Fatal error:', e); process.exit(1) })
