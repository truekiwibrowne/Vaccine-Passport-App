/**
 * Netlify HTTP Function — POST /.netlify/functions/send-notification
 * Body: { notificationId: string }
 *
 * Sends a specific notification immediately, regardless of its scheduledAt.
 * Used by the Admin Panel "Send Now" button.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function initAdmin() {
  const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set')
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) })
  }
}

function checkRule(rule, user) {
  switch (rule.type) {
    case 'all': return true
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

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let notificationId
  try {
    const body = await req.json()
    notificationId = body.notificationId
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!notificationId) {
    return new Response(JSON.stringify({ error: 'notificationId is required' }), { status: 400 })
  }

  try {
    initAdmin()
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 503 })
  }

  const db = getFirestore()
  const messaging = getMessaging()

  // Load the notification
  const notifDoc = await db.collection('Scheduled_Notifications').doc(notificationId).get()
  if (!notifDoc.exists) {
    return new Response(JSON.stringify({ error: 'Notification not found' }), { status: 404 })
  }

  const notif = notifDoc.data()

  if (notif.status === 'sending' || notif.status === 'sent') {
    return new Response(JSON.stringify({ error: `Notification is already ${notif.status}` }), { status: 409 })
  }

  await notifDoc.ref.update({ status: 'sending' })

  try {
    // Get all FCM tokens
    const tokenSnap = await db.collection('FCM_Tokens').get()
    const allTokenDocs = tokenSnap.docs.map(d => d.data())

    const targets = notif.targets || [{ type: 'all' }]
    const isAllUsers = targets.some(t => t.type === 'all')

    let matchingTokens = []

    if (isAllUsers) {
      matchingTokens = allTokenDocs.map(d => d.token).filter(Boolean)
    } else {
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

    let sentCount = 0
    let failedCount = 0

    if (matchingTokens.length > 0) {
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
          webpush: notif.actionUrl ? { fcmOptions: { link: notif.actionUrl } } : undefined,
        })
        sentCount += result.successCount
        failedCount += result.failureCount
      }
    }

    await notifDoc.ref.update({
      status: 'sent',
      sentAt: new Date().toISOString(),
      sentCount,
      failedCount,
    })

    return new Response(
      JSON.stringify({ success: true, sentCount, failedCount, totalTokens: matchingTokens.length }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('Send error:', err)
    await notifDoc.ref.update({ status: 'failed' }).catch(() => {})
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
