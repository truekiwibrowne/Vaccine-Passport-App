import { useRef, useState } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { buildVerifyUrl, APP_PUBLIC_URL } from '../../utils/qrPayload'
import { Button } from '../ui/Button'
import jsPDF from 'jspdf'
import type { PHRPassportSummary } from '../../types/user'

interface Props {
  uid: string
  firstName: string
  vaccineCount: number
  verifiedCount: number
  phrSummary?: PHRPassportSummary   // optional — only shown if user has enabled it
}

// ── PDF passport export ──────────────────────────────────────────────────────

async function exportPassportPdf(
  uid: string,
  firstName: string,
  vaccineCount: number,
  verifiedCount: number,
  qrCanvas: HTMLCanvasElement,
  phrSummary?: PHRPassportSummary,
) {
  const url  = buildVerifyUrl(uid)
  const now  = new Date()
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // A5 landscape (148 × 210 mm)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' })
  const W = 210, H = 148

  // ── Background ──────────────────────────────────────────────────────────
  pdf.setFillColor(30, 58, 138)   // blue-900
  pdf.roundedRect(0, 0, W, H, 0, 0, 'F')

  // ── Decorative circles ──────────────────────────────────────────────────
  pdf.setFillColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.04 }))
  pdf.circle(W * 0.82, -15, 55, 'F')
  pdf.circle(W * 0.88, H * 0.85, 40, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // ── Left panel text ─────────────────────────────────────────────────────
  const lx = 14

  // Label
  pdf.setTextColor(147, 197, 253)  // blue-300
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VACCINE PASSPORT', lx, 22)

  // Name
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(firstName.length > 14 ? 26 : 32)
  pdf.setFont('helvetica', 'bold')
  pdf.text(firstName, lx, 50)

  // Vaccine stats
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(200, 220, 255)
  pdf.text(`${verifiedCount} of ${vaccineCount} vaccines verified`, lx, 63)

  // Verified badge
  if (verifiedCount > 0) {
    pdf.setFillColor(255, 255, 255)
    pdf.setGState(pdf.GState({ opacity: 0.15 }))
    pdf.roundedRect(lx, 68, 45, 9, 4, 4, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text('✓  Verified', lx + 4, 74.5)
  }

  // PHR section (if enabled)
  let phrBlockBottom = 80
  if (phrSummary) {
    const phrY = 82
    pdf.setFillColor(255, 255, 255)
    pdf.setGState(pdf.GState({ opacity: 0.12 }))
    pdf.roundedRect(lx, phrY, 108, 28, 3, 3, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))

    // Section label
    pdf.setTextColor(147, 197, 253)
    pdf.setFontSize(6.5)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRIVATE HEALTH', lx + 4, phrY + 7)

    // Status
    const phrStatus = phrSummary.isClear && !phrSummary.isOnTreatment
      ? 'Clear'
      : phrSummary.isOnTreatment ? 'Receiving Treatment' : 'Results on File'
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text(phrStatus, lx + 4, phrY + 16)

    // Last tested
    const tested = new Date(phrSummary.lastTestedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    pdf.setFontSize(6.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(200, 220, 255)
    pdf.text(`Last tested: ${tested}`, lx + 4, phrY + 23)

    phrBlockBottom = phrY + 32
  }

  // Divider
  pdf.setDrawColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.12 }))
  pdf.line(lx, phrBlockBottom + 2, lx + 80, phrBlockBottom + 2)
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // Generated date
  pdf.setTextColor(147, 197, 253)
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generated ${date}`, lx, phrBlockBottom + 10)

  // URL
  pdf.setTextColor(147, 197, 253)
  pdf.setFontSize(7)
  const urlDisplay = APP_PUBLIC_URL.replace(/^https?:\/\//, '')
  pdf.text(urlDisplay, lx, H - 10)

  // ── QR code panel (right side) ──────────────────────────────────────────
  const QR_SIZE = 68
  const qrX = W - QR_SIZE - 18
  const qrY = H / 2 - QR_SIZE / 2 - 4

  // "Scan to verify" label above QR
  pdf.setTextColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.6 }))
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Scan to verify', qrX + QR_SIZE / 2, qrY - 4, { align: 'center' })
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // White QR background
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(qrX, qrY, QR_SIZE, QR_SIZE, 4, 4, 'F')

  // Draw QR image from canvas
  const qrDataUrl = qrCanvas.toDataURL('image/png')
  const pad = 3
  pdf.addImage(qrDataUrl, 'PNG', qrX + pad, qrY + pad, QR_SIZE - pad * 2, QR_SIZE - pad * 2)

  // App name under QR
  pdf.setTextColor(147, 197, 253)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VaxPass', qrX + QR_SIZE / 2, qrY + QR_SIZE + 6, { align: 'center' })

  pdf.save(`vaxpass-${firstName.toLowerCase()}.pdf`)
}

// ── Canvas helper: rounded rect (compat with older Safari) ──────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y);  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h);  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r);       ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function QRCodeDisplay({ uid, firstName, vaccineCount, verifiedCount, phrSummary }: Props) {
  const url = buildVerifyUrl(uid)
  const hiddenQrRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [walletInfo, setWalletInfo] = useState<null | 'apple' | 'google'>(null)

  // ── Share link ──────────────────────────────────────────────────────────
  function share() {
    if (navigator.share) {
      navigator.share({ title: 'My Vaccine Passport', url })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  // ── Download passport card as PNG ───────────────────────────────────────
  async function downloadCard() {
    setDownloading(true)
    try {
      // Get QR image data from the hidden QRCodeCanvas
      const qrCanvas = hiddenQrRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!qrCanvas) return
      const qrDataUrl = qrCanvas.toDataURL()

      const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = qrDataUrl
      })

      // Card dimensions — expand height when PHR block is present (2× for retina)
      const W = 750
      const H = phrSummary ? 530 : 430
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!

      // ── Background gradient ──
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, '#1e3a8a')  // blue-900
      grad.addColorStop(1, '#2563eb')  // blue-600
      ctx.fillStyle = grad
      rrect(ctx, 0, 0, W, H, 32)
      ctx.fill()

      // ── Decorative circle (top-right) ──
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath(); ctx.arc(W * 0.85, -30, 200, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(W * 0.9, H * 0.8, 140, 0, Math.PI * 2); ctx.fill()

      // ── "VACCINE PASSPORT" label ──
      ctx.fillStyle = 'rgba(147,197,253,0.9)'  // blue-300
      ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('VACCINE PASSPORT', 48, 70)

      // ── Name ──
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${firstName.length > 12 ? 44 : 54}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillText(firstName, 48, 148)

      // ── Verified count ──
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(`${verifiedCount} of ${vaccineCount} vaccines verified`, 48, 192)

      // ── Verified badge pill ──
      if (verifiedCount > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        rrect(ctx, 48, 210, 154, 38, 19)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText('✓  Verified', 68, 234)
      }

      // ── PHR block (only when enabled) ──
      let dividerY = 278
      if (phrSummary) {
        const phrTop = 268
        const phrH = 96

        // Frosted box
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        rrect(ctx, 48, phrTop, 390, phrH, 14)
        ctx.fill()

        // Section label
        ctx.fillStyle = 'rgba(147,197,253,0.9)'
        ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText('PRIVATE HEALTH', 68, phrTop + 26)

        // Status
        const phrStatus = phrSummary.isClear && !phrSummary.isOnTreatment
          ? 'Clear'
          : phrSummary.isOnTreatment
            ? 'Receiving Treatment'
            : 'Results on File'
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${phrStatus.length > 12 ? 20 : 24}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillText(phrStatus, 68, phrTop + 58)

        // Last tested date
        const tested = new Date(phrSummary.lastTestedDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
        ctx.fillStyle = 'rgba(200,220,255,0.85)'
        ctx.font = '400 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(`Last tested: ${tested}`, 68, phrTop + 82)

        dividerY = phrTop + phrH + 14
      }

      // ── Divider ──
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(48, dividerY, 260, 1)

      // ── Bottom URL ──
      const urlDisplay = APP_PUBLIC_URL.replace(/^https?:\/\//, '')
      ctx.fillStyle = 'rgba(147,197,253,0.85)'
      ctx.font = '400 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(urlDisplay, 48, H - 36)

      // ── "Scan to verify" label (above QR) ──
      const QR = 200, qrX = W - QR - 40, qrY = H / 2 - QR / 2 - 10
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '400 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Scan to verify', qrX + QR / 2, qrY - 14)
      ctx.textAlign = 'left'

      // ── QR white background ──
      ctx.fillStyle = '#ffffff'
      rrect(ctx, qrX, qrY, QR, QR, 14)
      ctx.fill()

      // ── QR image ──
      const pad = 10
      ctx.drawImage(qrImg, qrX + pad, qrY + pad, QR - pad * 2, QR - pad * 2)

      // ── Download ──
      canvas.toBlob(blob => {
        if (!blob) return
        const a = document.createElement('a')
        a.download = `vaccine-passport-${firstName.toLowerCase()}.png`
        a.href = URL.createObjectURL(blob)
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/png')
    } catch (err) {
      console.error('Card download error:', err)
      alert('Could not generate card. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // ── PDF export ──────────────────────────────────────────────────────────
  async function downloadPdf() {
    setExportingPdf(true)
    try {
      const qrCanvas = hiddenQrRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!qrCanvas) { alert('QR code not ready. Please try again.'); return }
      await exportPassportPdf(uid, firstName, vaccineCount, verifiedCount, qrCanvas, phrSummary)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Could not generate PDF. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  // ── Apple Wallet ────────────────────────────────────────────────────────
  async function handleAppleWallet() {
    try {
      const params = new URLSearchParams({ uid, name: firstName, verified: String(verifiedCount), total: String(vaccineCount) })
      const res = await fetch(`/.netlify/functions/apple-wallet?${params}`)
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.download = 'vaccine-passport.pkpass'
        a.href = URL.createObjectURL(blob)
        a.click()
        URL.revokeObjectURL(a.href)
      } else {
        setWalletInfo('apple')
      }
    } catch {
      setWalletInfo('apple')
    }
  }

  // ── Google Wallet ───────────────────────────────────────────────────────
  async function handleGoogleWallet() {
    try {
      const params = new URLSearchParams({ uid, name: firstName, verified: String(verifiedCount), total: String(vaccineCount) })
      const res = await fetch(`/.netlify/functions/google-wallet?${params}`)
      if (res.ok) {
        const { saveUrl } = await res.json() as { saveUrl: string }
        window.open(saveUrl, '_blank', 'noopener')
      } else {
        setWalletInfo('google')
      }
    } catch {
      setWalletInfo('google')
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-5 w-full max-w-xs">

        {/* ── Visible passport card ── */}
        <div className="bg-white rounded-3xl shadow-md p-6 flex flex-col items-center gap-4 w-full">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-base font-semibold text-gray-900">{firstName}</p>
            <p className="text-sm text-gray-500">
              {verifiedCount} verified · {vaccineCount} total
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl">
            <QRCodeSVG value={url} size={200} level="M" includeMargin />
          </div>
          <p className="text-xs text-gray-400 text-center">Scan to verify vaccine status</p>
        </div>

        {/* Hidden high-res QRCodeCanvas for card download */}
        <div ref={hiddenQrRef} className="sr-only" aria-hidden="true">
          <QRCodeCanvas value={url} size={360} level="H" />
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2 w-full">

          {/* Download row: PNG card + PDF */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" fullWidth loading={downloading} onClick={downloadCard}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PNG Card
            </Button>
            <Button variant="secondary" fullWidth loading={exportingPdf} onClick={downloadPdf}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </Button>
          </div>

          {/* Wallet row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Apple Wallet */}
            <button
              onClick={handleAppleWallet}
              className="flex items-center justify-center gap-2 py-3 bg-black text-white rounded-2xl text-sm font-semibold active:opacity-75 transition-opacity"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 814 1000" fill="currentColor">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.4-150.3-119.7C17 388.1 1 368.3 1 320.4c0-148.4 95.9-226.5 189.1-226.5 51 0 93.3 31.8 130 31.8 35.2 0 90.5-35.2 153.2-35.2 21.3 0 108.2 1.9 170.9 74.7zm-239.2-65.8c-28.5-24.8-70.8-45.6-113.1-45.6-57.3 0-107.1 37.2-141 92.5-30.4 50.1-48.9 115.1-48.9 177.6 0 9 .6 18.1 1.3 26.5 39.5 5.8 84.2-20.7 116.7-65.2 36.5-49.4 59.6-119.2 59.6-187.2 0-14.8-1.3-28.5-4.5-42.2 6.4 2.6 10.3 2.6 15.8 2.6 51 0 96.8-27.8 122.3-67.3 18.6-27.8 28.5-60.2 28.5-91.8 0-16.4-1.9-31.8-5.8-45.9-38.5 10.3-84.2 37.2-110.9 77.4z"/>
              </svg>
              Apple Wallet
            </button>

            {/* Google Wallet */}
            <button
              onClick={handleGoogleWallet}
              className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-800 rounded-2xl text-sm font-semibold active:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M45.12 24.5c0-1.57-.14-3.08-.41-4.54H24v8.59h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.21z"/>
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
              </svg>
              Google Wallet
            </button>
          </div>

          {/* Share link */}
          <Button variant="ghost" fullWidth onClick={share}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Link
          </Button>
        </div>
      </div>

      {/* ── Wallet setup info sheet ── */}
      {walletInfo && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={() => setWalletInfo(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {walletInfo === 'apple' ? (
                <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 814 1000" fill="currentColor">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.4-150.3-119.7C17 388.1 1 368.3 1 320.4c0-148.4 95.9-226.5 189.1-226.5 51 0 93.3 31.8 130 31.8 35.2 0 90.5-35.2 153.2-35.2 21.3 0 108.2 1.9 170.9 74.7zm-239.2-65.8c-28.5-24.8-70.8-45.6-113.1-45.6-57.3 0-107.1 37.2-141 92.5-30.4 50.1-48.9 115.1-48.9 177.6 0 9 .6 18.1 1.3 26.5 39.5 5.8 84.2-20.7 116.7-65.2 36.5-49.4 59.6-119.2 59.6-187.2 0-14.8-1.3-28.5-4.5-42.2 6.4 2.6 10.3 2.6 15.8 2.6 51 0 96.8-27.8 122.3-67.3 18.6-27.8 28.5-60.2 28.5-91.8 0-16.4-1.9-31.8-5.8-45.9-38.5 10.3-84.2 37.2-110.9 77.4z"/>
                  </svg>
                </div>
              ) : (
                <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" viewBox="0 0 48 48">
                    <path fill="#4285F4" d="M45.12 24.5c0-1.57-.14-3.08-.41-4.54H24v8.59h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.21z"/>
                    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
                    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
                  </svg>
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">
                  {walletInfo === 'apple' ? 'Apple Wallet' : 'Google Wallet'} not yet configured
                </p>
                <p className="text-xs text-gray-400">One-time setup needed</p>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2 text-xs text-gray-600 leading-relaxed">
              {walletInfo === 'apple' ? (
                <>
                  <p><strong>1.</strong> Join <strong>Apple Developer Program</strong> ($99/yr) at developer.apple.com</p>
                  <p><strong>2.</strong> Create a <strong>Pass Type ID</strong> in Certificates, IDs &amp; Profiles</p>
                  <p><strong>3.</strong> Download the certificate, then encode it: <code className="bg-white px-1 rounded">openssl → base64</code></p>
                  <p><strong>4.</strong> Add to Netlify env vars:</p>
                  <div className="bg-white rounded-xl p-2 font-mono space-y-0.5">
                    <p>APPLE_TEAM_ID</p>
                    <p>APPLE_PASS_TYPE_ID</p>
                    <p>APPLE_CERT_P12_BASE64</p>
                    <p>APPLE_CERT_PASS</p>
                  </div>
                </>
              ) : (
                <>
                  <p><strong>1.</strong> Go to <strong>Google Cloud Console</strong> → enable <strong>Google Wallet API</strong> (free)</p>
                  <p><strong>2.</strong> Create a <strong>Service Account</strong> → download the JSON key</p>
                  <p><strong>3.</strong> Register at <strong>pay.google.com/business/console</strong> to get an Issuer ID</p>
                  <p><strong>4.</strong> Add to Netlify env vars:</p>
                  <div className="bg-white rounded-xl p-2 font-mono space-y-0.5">
                    <p>GOOGLE_SERVICE_ACCOUNT_JSON</p>
                    <p>GOOGLE_WALLET_ISSUER_ID</p>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-4 text-center">
              In the meantime, use <strong>Download Card</strong> — a PNG you can save to your photo library and show anywhere.
            </p>

            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setWalletInfo(null)}>Close</Button>
              <Button fullWidth loading={downloading} onClick={() => { setWalletInfo(null); downloadCard() }}>
                Download Card
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
