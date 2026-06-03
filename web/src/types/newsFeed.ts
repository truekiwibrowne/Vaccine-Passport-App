import type { NotificationTarget } from './admin'

export interface NewsFeedPost {
  id: string
  title: string
  body: string
  imageUrl?: string
  actionUrl?: string
  actionLabel?: string    // e.g. "Read more", "Learn more"
  targets: NotificationTarget[]
  status: 'active' | 'archived' | 'pending'
  publishedAt: string     // ISO date shown to user
  createdBy: string
  createdAt: string
  updatedAt: string
  // Crawler-populated fields
  source?: string         // 'WHO' | 'CDC' | 'Google News' | 'manual'
  sourceUrl?: string      // Original article URL — used for deduplication
  crawledAt?: string      // ISO timestamp when crawler added this item
  badge?: string          // Suggested badge label from Claude
  // Push notification tracking
  pushSent?: boolean      // false = queued for push; true = already sent; missing = not yet queued
  pushSentAt?: string
  pushSentCount?: number
}

export type SponsoredBadge =
  | 'Health Tip'
  | 'Travel Health'
  | 'Did you know?'
  | 'Recommended'
  | 'Vaccine Update'
  | 'Safety Alert'

export interface SponsoredContent {
  id: string
  badge: SponsoredBadge
  title: string
  body: string
  imageUrl?: string
  actionUrl?: string
  actionLabel?: string    // e.g. "View vaccines", "Learn more"
  sponsorTag?: string     // optional tiny attribution, e.g. "Health Authority"
  targets: NotificationTarget[]
  priority: number        // higher number = shown first when multiple match
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}
