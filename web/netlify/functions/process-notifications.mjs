/**
 * Netlify Scheduled Function — runs every 5 minutes.
 * Finds notifications with status='scheduled' and scheduledAt <= now,
 * matches users to targeting rules, sends FCM push notifications,
 * and updates the notification status.
 *
 * Required env vars:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full JSON of Firebase service account key
 *   (download from Firebase Console → Project Settings → Service Accounts → Generate new private key)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

export const config = {
  schedule: '*/5 * * * *',
}

export default async function handler() {
  const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env

  if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON not set')
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 503 })
  }

  // Initialize Firebase Admin (avoid re-init on warm invocations)
  if (!getApps().length) {
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    initializeApp({ credential: cert(sa) })
  }

  const db = getFirestore()
  const messaging = getMessaging()
  const now = new Date().toISOString()

  // 1. Find due notifications
  const notifSnap = await db.collection('Scheduled_Notifications')
    .where('status', '==', 'scheduled')
    .where('scheduledAt', '<=', now)
    .get()

  if (notifSnap.empty) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  let totalProcessed = 0

  for (const notifDoc of notifSnap.docs) {
    const notif = notifDoc.data()
    try {
      // Mark as sending
      await notifDoc.ref.update({ status: 'sending' })

      // 2. Get all FCM tokens
      const tokenSnap = await db.collection('FCM_Tokens').get()
      const allTokenDocs = tokenSnap.docs.map(d => d.data())

      // 3. Filter users by targeting rules
      const targets = notif.targets || [{ type: 'all' }]
      const isAllUsers = targets.some(t => t.type === 'all')

      let matchingTokens = []

      if (isAllUsers) {
        matchingTokens = allTokenDocs.map(d => d.token).filter(Boolean)
      } else {
        // Load user profiles and check each rule
        for (const tokenDoc of allTokenDocs) {
          if (!tokenDoc.token || !tokenDoc.uid) continue
          try {
            const userSnap = await db.collection('User_Data').doc(tokenDoc.uid).get()
            if (!userSnap.exists) continue
            const user = userSnap.data()

            let matches = true
            for (const rule of targets) {
              if (!checkRule(rule, user)) { matches = false; break }
            }
            if (matches) matchingTokens.push(tokenDoc.token)
          } catch (e) {
            console.warn(`Error loading user ${tokenDoc.uid}:`, e)
          }
        }
      }

      if (matchingTokens.length === 0) {
        await notifDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString(), sentCount: 0, failedCount: 0 })
        continue
      }

      // 4. Send in batches of 500 (FCM limit)
      let sentCount = 0
      let failedCount = 0
      const BATCH = 500

      for (let i = 0; i < matchingTokens.length; i += BATCH) {
        const batch = matchingTokens.slice(i, i + BATCH)
        const result = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: {
            title: notif.title,
            body: notif.body,
            imageUrl: notif.imageUrl || undefined,
          },
          data: notif.actionUrl ? { url: notif.actionUrl } : {},
          webpush: notif.actionUrl ? {
            fcmOptions: { link: notif.actionUrl },
          } : undefined,
        })
        sentCount += result.successCount
        failedCount += result.failureCount
      }

      // 5. Update status to sent
      await notifDoc.ref.update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        sentCount,
        failedCount,
      })
      totalProcessed++
    } catch (err) {
      console.error(`Failed to process notification ${notifDoc.id}:`, err)
      await notifDoc.ref.update({ status: 'failed' }).catch(() => {})
    }
  }

  // ── B. News post push notifications ────────────────────────────────────────
  // Find active news posts that haven't been push-notified yet.
  // Sets pushSent: true on each post after sending so it never fires again.
  try {
    // Match posts where pushSent is explicitly false OR the field doesn't exist yet
    // (Firestore can't do OR across fields, so we query both and deduplicate)
    const [newFalse, newMissing] = await Promise.all([
      db.collection('News_Feed').where('status', '==', 'active').where('pushSent', '==', false).get(),
      db.collection('News_Feed').where('status', '==', 'active').where('pushSent', 'not-in', [true, false]).get(),
    ])
    const seenIds = new Set()
    const newsSnap = { docs: [...newFalse.docs, ...newMissing.docs].filter(d => { if (seenIds.has(d.id)) return false; seenIds.add(d.id); return true }) }

    for (const newsDoc of newsSnap.docs) {
      const post = newsDoc.data()
      try {
        // Get all FCM tokens
        const tokenSnap = await db.collection('FCM_Tokens').get()
        const targets   = post.targets || [{ type: 'all' }]
        const isAll     = targets.some(t => t.type === 'all')

        let matchingTokens = []

        if (isAll) {
          matchingTokens = tokenSnap.docs.map(d => d.data().token).filter(Boolean)
        } else {
          for (const tokenDoc of tokenSnap.docs) {
            const { token, uid } = tokenDoc.data()
            if (!token || !uid) continue
            try {
              const userSnap = await db.collection('User_Data').doc(uid).get()
              if (!userSnap.exists) continue
              const user = userSnap.data()
              if (targets.every(rule => checkRule(rule, user))) matchingTokens.push(token)
            } catch { /* skip this user */ }
          }
        }

        let newsSent = 0, newsFailed = 0
        const BATCH = 500
        for (let i = 0; i < matchingTokens.length; i += BATCH) {
          const result = await messaging.sendEachForMulticast({
            tokens: matchingTokens.slice(i, i + BATCH),
            notification: {
              title: post.badge ? `[${post.badge}] ${post.title}` : post.title,
              body: (post.body || '').slice(0, 200),
              imageUrl: post.imageUrl || undefined,
            },
            data: post.actionUrl ? { url: post.actionUrl } : {},
            webpush: post.actionUrl ? { fcmOptions: { link: post.actionUrl } } : undefined,
          })
          newsSent   += result.successCount
          newsFailed += result.failureCount
        }

        await newsDoc.ref.update({
          pushSent:    true,
          pushSentAt:  new Date().toISOString(),
          pushSentCount: newsSent,
        })
        console.log(`[news push] "${post.title.slice(0, 50)}" → ${newsSent} sent, ${newsFailed} failed`)
        totalProcessed++
      } catch (err) {
        console.error(`Failed to push news post ${newsDoc.id}:`, err)
      }
    }
  } catch (err) {
    console.error('News notification sweep error:', err)
  }

  return new Response(JSON.stringify({ processed: totalProcessed }), { status: 200 })
}

/** Check if a user profile matches a single targeting rule */
function checkRule(rule, user) {
  switch (rule.type) {
    case 'all':
      return true

    case 'location': {
      const country = user.Passport_Issuing_Country || user.travelDestination || ''
      return rule.countries?.some(c => c.toUpperCase() === country.toUpperCase()) ?? false
    }

    case 'gender':
      return (user.gender || '').toLowerCase() === (rule.value || '').toLowerCase()

    case 'biologicalSex':
      return (user.biologicalSex || '').toLowerCase() === (rule.value || '').toLowerCase()

    case 'ageRange': {
      if (!user.Date_of_Birth) return false
      const dob = new Date(user.Date_of_Birth)
      const today = new Date()
      const age = today.getFullYear() - dob.getFullYear()
      if (rule.minAge != null && age < rule.minAge) return false
      if (rule.maxAge != null && age > rule.maxAge) return false
      return true
    }

    case 'hasVaccine':
    case 'missingVaccine': {
      // vaccine_names is a denormalized array stored on the user doc for fast querying
      const vaccines = user.vaccine_names || []
      const hasIt = vaccines.some(n =>
        n.toLowerCase().includes((rule.vaccineName || '').toLowerCase())
      )
      return rule.type === 'hasVaccine' ? hasIt : !hasIt
    }

    default:
      return true
  }
}
