/**
 * vaccine-news-crawler/index.ts
 *
 * Fetches vaccine news from WHO, CDC, and Google News RSS feeds,
 * uses Claude to summarise each article and suggest audience targeting,
 * then writes pending posts to the Firestore News_Feed collection.
 *
 * Runs as a GitHub Actions scheduled job (every 6 hours).
 * Requires environment variables:
 *   ANTHROPIC_API_KEY       — from console.anthropic.com
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 *
 * For local testing, omit FIREBASE_SERVICE_ACCOUNT and place
 * serviceAccountKey.json in the repo root (one level up).
 */

import Anthropic from '@anthropic-ai/sdk'
import * as admin from 'firebase-admin'
import Parser from 'rss-parser'
import * as path from 'path'
import * as fs from 'fs'

// ── Firebase init ──────────────────────────────────────────────────────────────

function initFirebase(): admin.firestore.Firestore {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT
  let serviceAccount: admin.ServiceAccount

  if (envJson) {
    // GitHub Actions: secret stored as base64-encoded JSON
    serviceAccount = JSON.parse(
      Buffer.from(envJson, 'base64').toString('utf8')
    ) as admin.ServiceAccount
  } else {
    // Local dev: use serviceAccountKey.json in repo root
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

const db   = initFirebase()
const NEWS_COL = 'News_Feed'

// ── Anthropic init ─────────────────────────────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required.')
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    // Only items that mention vaccines / immunisation
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
    // CDC Vaccines & Immunizations news feed
    url: 'https://tools.cdc.gov/api/v2/resources/media/404952.rss',
    filter: () => true,
  },
  {
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=vaccine+news+health&hl=en-US&gl=US&ceid=US:en',
    filter: () => true,
  },
]

// Max articles processed per feed per crawl run (keeps Claude API costs low)
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

// ── Claude analysis ────────────────────────────────────────────────────────────

interface ArticleAnalysis {
  title: string
  body: string
  badge: 'Health Tip' | 'Travel Health' | 'Did you know?' | 'Recommended' | 'Vaccine Update' | 'Safety Alert'
  countries: string[]        // ISO-3166-1 alpha-2 codes, or ["all"] for global
  minAge: number | null      // e.g. 60 for senior content, 18 for adults only
  maxAge: number | null      // e.g. 2 for infant/toddler, 17 for paediatric
  gender: 'male' | 'female' | null  // only set when strictly gender-specific
}

async function analyseWithClaude(
  rawTitle: string,
  rawSnippet: string,
  sourceName: string,
): Promise<ArticleAnalysis | null> {
  const prompt = `You are a health news editor for a global vaccine passport app whose users include travellers, parents, seniors, and healthcare workers.

Article from ${sourceName}:
Title: ${rawTitle}
Excerpt: ${rawSnippet.slice(0, 900)}

Return ONLY a JSON object (no markdown, no code fences, no explanation) with exactly these fields:
{
  "title": "Concise, engaging headline under 80 characters — no clickbait",
  "body": "2-3 plain-language sentences summarising the news for a general audience",
  "badge": "Exactly one of: Health Tip | Travel Health | Did you know? | Recommended | Vaccine Update | Safety Alert",
  "countries": ["ISO-3166-1 alpha-2 codes for countries mentioned (e.g. KE, AU, GB, US) — use [\"all\"] if the news applies globally"],
  "minAge": null or integer (e.g. 60 for senior-specific, 18 for adult-only, 65 for elderly),
  "maxAge": null or integer (e.g. 2 for infant/toddler, 17 for paediatric / under-18),
  "gender": null or "female" or "male" (ONLY set this if the vaccine/news is strictly gender-specific, e.g. HPV, cervical cancer, prostate)
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(cleaned) as ArticleAnalysis
  } catch (e) {
    console.error(`    Claude error: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

// ── Build Firestore targets array ──────────────────────────────────────────────

function buildTargets(analysis: ArticleAnalysis): object[] {
  const targets: object[] = []

  const isGlobal =
    analysis.countries.includes('all') ||
    analysis.countries.length === 0

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
  const runStart = new Date().toISOString()
  console.log(`\n${'═'.repeat(60)}`)
  console.log(` Vaccine News Crawler — ${runStart}`)
  console.log(`${'═'.repeat(60)}\n`)

  const parser = new Parser()
  const existingUrls = await getExistingSourceUrls()
  console.log(`Loaded ${existingUrls.size} already-indexed article URLs\n`)

  let totalAdded   = 0
  let totalSkipped = 0

  for (const feed of FEEDS) {
    console.log(`▶ Fetching ${feed.name} (${feed.url})…`)

    let feedResult: Parser.Output<Parser.Item>
    try {
      feedResult = await parser.parseURL(feed.url)
    } catch (e) {
      console.error(`  ✗ Failed to fetch feed: ${e instanceof Error ? e.message : String(e)}\n`)
      continue
    }

    const relevant = (feedResult.items ?? []).filter(feed.filter)
    console.log(`  ${relevant.length} relevant items found`)

    let feedAdded = 0

    for (const item of relevant.slice(0, MAX_PER_FEED)) {
      const url = item.link ?? item.guid ?? ''
      if (!url) { totalSkipped++; continue }

      if (existingUrls.has(url)) {
        totalSkipped++
        continue
      }

      const rawTitle   = (item.title   ?? 'Vaccine News').trim()
      const rawSnippet = (item.contentSnippet ?? item.summary ?? '').trim()

      console.log(`  → ${rawTitle.slice(0, 70)}…`)

      const analysis = await analyseWithClaude(rawTitle, rawSnippet, feed.name)
      if (!analysis) {
        console.log('    ✗ Skipped (Claude returned no result)')
        totalSkipped++
        continue
      }

      const now = new Date().toISOString()
      const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : now

      await db.collection(NEWS_COL).add({
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
      })

      existingUrls.add(url)
      feedAdded++
      totalAdded++
      console.log(`    ✓ Queued: "${analysis.title}"`)
    }

    console.log(`  ${feedAdded} new items queued from ${feed.name}\n`)
  }

  console.log(`${'═'.repeat(60)}`)
  console.log(` Run complete  |  +${totalAdded} queued  |  ${totalSkipped} skipped`)
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal crawler error:', e)
    process.exit(1)
  })
