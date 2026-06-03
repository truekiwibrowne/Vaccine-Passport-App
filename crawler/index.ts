/**
 * vaccine-news-crawler/index.ts
 *
 * Fetches vaccine news from WHO, CDC, and Google News RSS feeds,
 * analyses each article with keyword matching, then writes pending
 * posts to the Firestore News_Feed collection for admin review.
 *
 * Runs as a GitHub Actions scheduled job (every 6 hours).
 * Required secret:
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 *
 * Optional future upgrade — set either of these to enable AI summaries:
 *   ANTHROPIC_API_KEY  — uses Claude (claude-haiku-4-5 for low cost)
 *   GEMINI_API_KEY     — uses Google Gemini 1.5 Flash (free tier)
 */

import * as admin from 'firebase-admin'
import Parser from 'rss-parser'
import * as path from 'path'
import * as fs from 'fs'

// ── Open Graph image fetcher ───────────────────────────────────────────────────
// Tries RSS-embedded media first (no extra HTTP request), then falls back to
// fetching the article page and extracting og:image / twitter:image.

type RssItemWithMedia = Parser.Item & {
  enclosure?: { url?: string; type?: string }
  'media:content'?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>
  'media:thumbnail'?: { $?: { url?: string } }
}

function rssEmbeddedImage(item: RssItemWithMedia): string | null {
  // enclosure (standard RSS 2.0)
  if (item.enclosure?.url && /^https?:/.test(item.enclosure.url)) {
    return item.enclosure.url
  }
  // media:content (Media RSS)
  const mc = item['media:content']
  if (mc) {
    const first = Array.isArray(mc) ? mc[0] : mc
    const url = first?.$?.url
    if (url && /^https?:/.test(url)) return url
  }
  // media:thumbnail
  const mt = item['media:thumbnail']
  if (mt?.$?.url && /^https?:/.test(mt.$!.url!)) return mt.$!.url!
  return null
}

async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(articleUrl, {
      signal: controller.signal as RequestInit['signal'],
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VaccinePassportBot/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null

    // Only read the first 30 KB — the <head> is always near the top
    const reader = res.body?.getReader()
    if (!reader) return null
    let html = ''
    let bytes = 0
    while (bytes < 30_000) {
      const { done, value } = await reader.read()
      if (done) break
      html += Buffer.from(value).toString('utf8')
      bytes += value.length
    }
    reader.cancel().catch(() => {})

    // og:image (two attribute orderings)
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogMatch?.[1] && /^https?:/.test(ogMatch[1])) return ogMatch[1]

    // twitter:image fallback
    const twMatch =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    if (twMatch?.[1] && /^https?:/.test(twMatch[1])) return twMatch[1]

    return null
  } catch {
    return null
  }
}

async function resolveImage(item: RssItemWithMedia, articleUrl: string): Promise<string | null> {
  const embedded = rssEmbeddedImage(item)
  if (embedded) return embedded
  return fetchOgImage(articleUrl)
}

// ── Firebase init ──────────────────────────────────────────────────────────────

function initFirebase(): admin.firestore.Firestore {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT
  let serviceAccount: admin.ServiceAccount

  if (envJson) {
    serviceAccount = JSON.parse(
      Buffer.from(envJson, 'base64').toString('utf8')
    ) as admin.ServiceAccount
  } else {
    const keyPath = path.resolve(__dirname, '../serviceAccountKey.json')
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        'No FIREBASE_SERVICE_ACCOUNT env var and no serviceAccountKey.json found.\n' +
        'Set the env var or place the key file at the repo root.'
      )
    }
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  return admin.firestore()
}

const db = initFirebase()
const NEWS_COL = 'News_Feed'

// ── RSS feed definitions ───────────────────────────────────────────────────────

interface FeedDef {
  name: string
  url: string
  filter: (item: Parser.Item) => boolean
}

const FEEDS: FeedDef[] = [
  {
    name: 'WHO',
    url: 'https://www.who.int/feeds/entity/news/en/rss.xml',
    filter: (item) => {
      const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase()
      return (
        text.includes('vaccin') ||
        text.includes('immuniz') ||
        text.includes('immunis') ||
        text.includes('outbreak') ||
        text.includes('disease prevention')
      )
    },
  },
  {
    name: 'CDC',
    url: 'https://tools.cdc.gov/api/v2/resources/media/404952.rss',
    filter: () => true,
  },
  {
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=vaccine+news+health&hl=en-US&gl=US&ceid=US:en',
    filter: () => true,
  },
]

const MAX_PER_FEED = 8

// ── Deduplication ──────────────────────────────────────────────────────────────

async function getExistingSourceUrls(): Promise<Set<string>> {
  const snap = await db.collection(NEWS_COL).get()
  const urls = new Set<string>()
  snap.docs.forEach(d => {
    const url = (d.data().sourceUrl as string | undefined) ?? ''
    if (url) urls.add(url)
  })
  return urls
}

// ── Keyword-based article analysis ────────────────────────────────────────────
// No API key required. Derives badge, targeting, and a clean body from the
// raw RSS title + snippet using simple keyword matching.
//
// To upgrade to AI summaries later, set ANTHROPIC_API_KEY or GEMINI_API_KEY
// in GitHub Actions secrets — the aiAnalyse() function below will activate.

interface ArticleAnalysis {
  title: string
  body: string
  badge: string
  countries: string[]
  minAge: number | null
  maxAge: number | null
  gender: 'male' | 'female' | null
}

// Country name → ISO-3166-1 alpha-2 mapping (common vaccine-news countries)
const COUNTRY_KEYWORDS: [string, string][] = [
  ['united states', 'US'], ['usa', 'US'], ['u.s.', 'US'],
  ['united kingdom', 'GB'], ['u.k.', 'GB'],
  ['australia', 'AU'], ['new zealand', 'NZ'],
  ['canada', 'CA'], ['india', 'IN'], ['china', 'CN'],
  ['nigeria', 'NG'], ['kenya', 'KE'], ['south africa', 'ZA'],
  ['ethiopia', 'ET'], ['ghana', 'GH'], ['tanzania', 'TZ'],
  ['brazil', 'BR'], ['mexico', 'MX'], ['argentina', 'AR'],
  ['germany', 'DE'], ['france', 'FR'], ['italy', 'IT'],
  ['japan', 'JP'], ['south korea', 'KR'], ['indonesia', 'ID'],
  ['pakistan', 'PK'], ['bangladesh', 'BD'], ['philippines', 'PH'],
]

function detectCountries(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const [name, code] of COUNTRY_KEYWORDS) {
    if (lower.includes(name) && !found.includes(code)) found.push(code)
  }
  return found
}

function detectBadge(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('travel') || t.includes('border') || t.includes('tourism') || t.includes('abroad')) return 'Travel Health'
  if (t.includes('alert') || t.includes('outbreak') || t.includes('emergency') || t.includes('warning')) return 'Safety Alert'
  if (t.includes('recommend') || t.includes('schedule') || t.includes('routine')) return 'Recommended'
  if (t.includes('update') || t.includes('approved') || t.includes('new vaccine') || t.includes('authoriz')) return 'Vaccine Update'
  if (t.includes('did you know') || t.includes('fact') || t.includes('myth') || t.includes('research')) return 'Did you know?'
  return 'Health Tip'
}

function detectAgeRange(text: string): { minAge: number | null; maxAge: number | null } {
  const t = text.toLowerCase()
  if (t.includes('infant') || t.includes('newborn') || t.includes('neonate') || t.includes('0-2') || t.includes('0 to 2')) {
    return { minAge: null, maxAge: 2 }
  }
  if (t.includes('child') || t.includes('paediatric') || t.includes('pediatric') || t.includes('school-age')) {
    return { minAge: null, maxAge: 17 }
  }
  if (t.includes('elderly') || t.includes('older adult') || t.includes('aged 65') || t.includes('65 and older') || t.includes('65+')) {
    return { minAge: 65, maxAge: null }
  }
  if (t.includes('senior') || t.includes('aged 60') || t.includes('60 and older') || t.includes('60+')) {
    return { minAge: 60, maxAge: null }
  }
  if (t.includes('adolescent') || t.includes('teen') || t.includes('12-18') || t.includes('12 to 18')) {
    return { minAge: 12, maxAge: 18 }
  }
  return { minAge: null, maxAge: null }
}

function detectGender(text: string): 'male' | 'female' | null {
  const t = text.toLowerCase()
  if (t.includes('cervical') || t.includes('ovarian') || t.includes('maternal') || t.includes('pregnancy') || t.includes('pregnant')) return 'female'
  if (t.includes('prostate')) return 'male'
  // HPV vaccines are recommended for all genders — don't filter
  return null
}

function cleanSnippet(raw: string): string {
  // Strip HTML tags, decode common entities, collapse whitespace
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

function keywordAnalyse(
  rawTitle: string,
  rawSnippet: string,
): ArticleAnalysis {
  const title = rawTitle.trim().slice(0, 120)
  const body  = cleanSnippet(rawSnippet) || title
  const combined = `${title} ${body}`

  return {
    title,
    body,
    badge:    detectBadge(combined),
    countries: detectCountries(combined),
    ...detectAgeRange(combined),
    gender:   detectGender(combined),
  }
}

// ── Optional AI upgrade (activates when API key is present) ───────────────────
// Plug in ANTHROPIC_API_KEY or GEMINI_API_KEY in GitHub Actions secrets to
// enable richer summaries without changing any code.

async function aiAnalyse(
  rawTitle: string,
  rawSnippet: string,
  sourceName: string,
): Promise<ArticleAnalysis | null> {
  // ── Claude (Anthropic) ──────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Anthropic = require('@anthropic-ai/sdk').default
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const prompt = buildAiPrompt(rawTitle, rawSnippet, sourceName)
      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })
      const text: string = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
      return JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')) as ArticleAnalysis
    } catch (e) {
      console.warn('  Claude unavailable, falling back to keyword analysis:', (e as Error).message)
    }
  }

  // ── Gemini (Google — free tier) ─────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildAiPrompt(rawTitle, rawSnippet, sourceName) }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
          }),
        }
      )
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      return JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')) as ArticleAnalysis
    } catch (e) {
      console.warn('  Gemini unavailable, falling back to keyword analysis:', (e as Error).message)
    }
  }

  return null
}

function buildAiPrompt(rawTitle: string, rawSnippet: string, sourceName: string): string {
  return `You are a health news editor for a global vaccine passport app.

Article from ${sourceName}:
Title: ${rawTitle}
Excerpt: ${rawSnippet.slice(0, 800)}

Return ONLY a JSON object (no markdown, no code fences) with exactly these fields:
{
  "title": "Concise headline under 80 characters",
  "body": "2-3 plain-language sentences for a general audience",
  "badge": "One of: Health Tip | Travel Health | Did you know? | Recommended | Vaccine Update | Safety Alert",
  "countries": ["ISO-3166-1 alpha-2 codes if geographically specific, e.g. AU,KE — or use all for global"],
  "minAge": null or integer (e.g. 60 for senior, 18 for adult-only),
  "maxAge": null or integer (e.g. 2 for infant, 17 for paediatric),
  "gender": null or "female" or "male" (only if strictly gender-specific)
}`
}

async function analyseArticle(
  rawTitle: string,
  rawSnippet: string,
  sourceName: string,
): Promise<ArticleAnalysis> {
  // Try AI first (only activates if an API key is set), fall back to keywords
  const ai = await aiAnalyse(rawTitle, rawSnippet, sourceName)
  return ai ?? keywordAnalyse(rawTitle, rawSnippet)
}

// ── Build Firestore targets array ──────────────────────────────────────────────

function buildTargets(analysis: ArticleAnalysis): object[] {
  const targets: object[] = []

  const isGlobal = analysis.countries.length === 0 || analysis.countries.includes('all')
  if (isGlobal) {
    targets.push({ type: 'all' })
  } else {
    targets.push({ type: 'location', countries: analysis.countries })
  }

  if (analysis.minAge != null || analysis.maxAge != null) {
    const rule: Record<string, unknown> = { type: 'ageRange' }
    if (analysis.minAge != null) rule.minAge = analysis.minAge
    if (analysis.maxAge != null) rule.maxAge = analysis.maxAge
    targets.push(rule)
  }

  if (analysis.gender) {
    targets.push({ type: 'gender', value: analysis.gender })
  }

  return targets
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const aiMode = process.env.ANTHROPIC_API_KEY
    ? 'Claude'
    : process.env.GEMINI_API_KEY
      ? 'Gemini'
      : 'keyword matching (free)'

  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Vaccine News Crawler — ${new Date().toISOString()}`)
  console.log(` Analysis mode: ${aiMode}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Configure parser to pull media:content and media:thumbnail from RSS
  const parser = new Parser({
    customFields: {
      item: [
        ['media:content',   'media:content',   { keepArray: false }],
        ['media:thumbnail', 'media:thumbnail', { keepArray: false }],
      ],
    },
  })

  const existingUrls = await getExistingSourceUrls()
  console.log(`Loaded ${existingUrls.size} already-indexed article URLs\n`)

  let totalAdded   = 0
  let totalSkipped = 0

  for (const feed of FEEDS) {
    console.log(`▶ Fetching ${feed.name}…`)

    let feedResult: Parser.Output<Parser.Item>
    try {
      feedResult = await parser.parseURL(feed.url)
    } catch (e) {
      console.error(`  ✗ Failed: ${(e as Error).message}\n`)
      continue
    }

    const relevant = (feedResult.items ?? []).filter(feed.filter)
    console.log(`  ${relevant.length} relevant items`)

    let feedAdded = 0

    for (const item of relevant.slice(0, MAX_PER_FEED)) {
      const url = item.link ?? item.guid ?? ''
      if (!url || existingUrls.has(url)) { totalSkipped++; continue }

      const rawTitle   = (item.title ?? 'Vaccine News').trim()
      const rawSnippet = (item.contentSnippet ?? item.summary ?? '').trim()

      console.log(`  → ${rawTitle.slice(0, 65)}…`)

      // Run analysis and image fetch in parallel
      const [analysis, imageUrl] = await Promise.all([
        analyseArticle(rawTitle, rawSnippet, feed.name),
        resolveImage(item as RssItemWithMedia, url),
      ])
      if (imageUrl) console.log(`    🖼  Image: ${imageUrl.slice(0, 80)}`)

      const now     = new Date().toISOString()
      const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : now

      const doc: Record<string, unknown> = {
        title:       analysis.title,
        body:        analysis.body,
        badge:       analysis.badge,
        actionUrl:   url,
        actionLabel: 'Read more',
        targets:     buildTargets(analysis),
        status:      'pending',
        publishedAt: pubDate,
        source:      feed.name,
        sourceUrl:   url,
        crawledAt:   now,
        createdBy:   'crawler',
        createdAt:   now,
        updatedAt:   now,
      }
      if (imageUrl) doc.imageUrl = imageUrl

      await db.collection(NEWS_COL).add(doc)

      existingUrls.add(url)
      feedAdded++
      totalAdded++
      console.log(`    ✓ Queued: "${analysis.title.slice(0, 60)}"`)
    }

    console.log(`  ${feedAdded} new items queued\n`)
  }

  console.log(`${'═'.repeat(60)}`)
  console.log(` Done  |  +${totalAdded} queued  |  ${totalSkipped} skipped`)
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal crawler error:', e)
    process.exit(1)
  })
