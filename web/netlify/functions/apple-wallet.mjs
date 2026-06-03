/**
 * Apple Wallet pass generator (.pkpass)
 *
 * Required Netlify environment variables:
 *   APPLE_TEAM_ID          — 10-character Apple Developer Team ID
 *   APPLE_PASS_TYPE_ID     — Pass Type ID, e.g. pass.com.yourname.vaccination
 *   APPLE_CERT_P12_BASE64  — Base64-encoded .p12 certificate bundle
 *   APPLE_CERT_PASS        — Password for the .p12 file
 *
 * Setup steps:
 *   1. Join Apple Developer Program ($99/yr) at developer.apple.com
 *   2. Certificates, IDs & Profiles → Identifiers → Pass Type IDs → Register
 *   3. Certificates → + → Pass Type ID Certificate → download
 *   4. Export from Keychain as .p12, then: base64 -i pass.p12 | pbcopy
 *   5. Add all four env vars to Netlify → Site → Environment variables
 *   6. npm install passkit-generator  (add to web/package.json dependencies)
 */

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const {
    APPLE_TEAM_ID,
    APPLE_PASS_TYPE_ID,
    APPLE_CERT_P12_BASE64,
    APPLE_CERT_PASS,
  } = process.env

  if (!APPLE_TEAM_ID || !APPLE_PASS_TYPE_ID || !APPLE_CERT_P12_BASE64 || !APPLE_CERT_PASS) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Apple Wallet not configured',
        missing: [
          !APPLE_TEAM_ID         && 'APPLE_TEAM_ID',
          !APPLE_PASS_TYPE_ID    && 'APPLE_PASS_TYPE_ID',
          !APPLE_CERT_P12_BASE64 && 'APPLE_CERT_P12_BASE64',
          !APPLE_CERT_PASS       && 'APPLE_CERT_PASS',
        ].filter(Boolean),
      }),
    }
  }

  const params   = new URLSearchParams(event.queryStringParameters ?? {})
  const uid      = params.get('uid') ?? 'unknown'
  const name     = params.get('name') ?? 'Passport Holder'
  const verified = params.get('verified') ?? '0'
  const total    = params.get('total') ?? '0'
  const verifyUrl = `https://vaxpass-app.netlify.app/verify/${uid}`

  try {
    // Requires: npm install passkit-generator
    const { PKPass } = await import('passkit-generator')

    const certBuffer = Buffer.from(APPLE_CERT_P12_BASE64, 'base64')

    // Apple WWDR G4 certificate (intermediate CA) — required for signing
    const wwdrRes = await fetch('https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer')
    const wwdr    = Buffer.from(await wwdrRes.arrayBuffer())

    const pass = new PKPass({}, {
      wwdr,
      signerCert: certBuffer,
      signerKey:  certBuffer,
      signerKeyPassphrase: APPLE_CERT_PASS,
    }, {
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      teamIdentifier:     APPLE_TEAM_ID,
      organizationName:   'Vaccine Passport',
      description:        'Vaccine Passport',
      serialNumber:       uid,
      logoText:           'VaxPass',
      foregroundColor:    'rgb(255,255,255)',
      backgroundColor:    'rgb(37,99,235)',
      labelColor:         'rgb(147,197,253)',
    })

    pass.type = 'generic'

    pass.primaryFields.push({
      key: 'name', label: 'NAME', value: name,
    })
    pass.secondaryFields.push(
      { key: 'verified', label: 'VERIFIED',        value: `${verified} of ${total}` },
      { key: 'status',   label: 'PASSPORT STATUS', value: Number(verified) > 0 ? 'Active' : 'Self-reported' },
    )
    pass.backFields.push({
      key:   'verify',
      label: 'Verify online',
      value: verifyUrl,
      attributedValue: `<a href="${verifyUrl}">${verifyUrl}</a>`,
    })

    pass.setBarcodes({
      message:         verifyUrl,
      format:          'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    })

    const buffer = pass.getAsBuffer()

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type':        'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="vaccine-passport.pkpass"',
      },
      body:            buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('Apple Wallet generation error:', err)
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
