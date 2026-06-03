/**
 * Google Wallet pass generator — returns a "Save to Google Wallet" URL.
 *
 * Required Netlify environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — Full JSON content of the service account key file
 *   GOOGLE_WALLET_ISSUER_ID     — Issuer ID from Google Pay & Wallet Console
 *
 * Setup steps (all free):
 *   1. Go to console.cloud.google.com → Create/select a project
 *   2. Enable "Google Wallet API" in the API Library
 *   3. IAM → Service Accounts → Create → download the JSON key
 *   4. Go to pay.google.com/business/console → Register as issuer → copy Issuer ID
 *   5. Grant the service account "Google Wallet Object Writer" role in Pay Console
 *   6. Add GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_WALLET_ISSUER_ID to Netlify env vars
 */

import { createSign } from 'node:crypto'

const WALLET_BASE = 'https://pay.google.com/gp/v/save'

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const { GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_WALLET_ISSUER_ID } = process.env

  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_WALLET_ISSUER_ID) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Google Wallet not configured',
        missing: [
          !GOOGLE_SERVICE_ACCOUNT_JSON && 'GOOGLE_SERVICE_ACCOUNT_JSON',
          !GOOGLE_WALLET_ISSUER_ID     && 'GOOGLE_WALLET_ISSUER_ID',
        ].filter(Boolean),
      }),
    }
  }

  const params = new URLSearchParams(event.queryStringParameters ?? {})
  const uid      = params.get('uid') ?? 'unknown'
  const name     = params.get('name') ?? 'Passport Holder'
  const verified = params.get('verified') ?? '0'
  const total    = params.get('total') ?? '0'

  try {
    const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON)
    const issuerId = GOOGLE_WALLET_ISSUER_ID

    const classId  = `${issuerId}.vaccine_passport`
    const objectId = `${issuerId}.${uid}`
    const verifyUrl = `https://vaxpass-app.netlify.app/verify/${uid}`

    const genericObject = {
      id: objectId,
      classId,
      state: 'ACTIVE',
      cardTitle:  { defaultValue: { language: 'en-US', value: 'Vaccine Passport' } },
      header:     { defaultValue: { language: 'en-US', value: name } },
      subheader:  { defaultValue: { language: 'en-US', value: 'VaxPass' } },
      textModulesData: [
        { header: 'VERIFIED VACCINES', body: `${verified} of ${total}`, id: 'vaccines' },
        { header: 'VERIFY ONLINE',     body: verifyUrl,                 id: 'link'     },
      ],
      barcode: { type: 'QR_CODE', value: verifyUrl, alternateText: 'Scan to verify' },
      hexBackgroundColor: '#1d4ed8',
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: serviceAccount.client_email,
      aud: 'google',
      origins: ['https://vaxpass-app.netlify.app'],
      typ: 'savetowallet',
      iat: now,
      payload: { genericObjects: [genericObject] },
    }

    const header  = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
    const body    = base64url(Buffer.from(JSON.stringify(payload)))
    const signing = `${header}.${body}`

    const sign = createSign('RSA-SHA256')
    sign.update(signing)
    const sig   = base64url(sign.sign(serviceAccount.private_key))
    const token = `${signing}.${sig}`

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveUrl: `${WALLET_BASE}/${token}` }),
    }
  } catch (err) {
    console.error('Google Wallet error:', err)
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
