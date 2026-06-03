import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { NewsFeedPost, SponsoredContent, SponsoredBadge } from '../types/newsFeed'
import type { NotificationTarget } from '../types/admin'
import {
  getAllNewsPosts, createNewsPost, updateNewsPost, deleteNewsPost,
  getPendingNewsPosts,
  getAllSponsoredContent, createSponsoredContent, updateSponsoredContent, deleteSponsoredContent,
} from '../services/newsFeedService'
import { useIsLg } from '../hooks/useMediaQuery'

// ─── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400'
const BADGE_OPTIONS: SponsoredBadge[] = ['Health Tip', 'Travel Health', 'Did you know?', 'Recommended', 'Vaccine Update', 'Safety Alert']

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

// ─── Targeting editor ──────────────────────────────────────────────────────────
type RuleType = NotificationTarget['type']

function blankRule(type: RuleType): NotificationTarget {
  switch (type) {
    case 'all':            return { type: 'all' }
    case 'location':       return { type: 'location', countries: [] }
    case 'gender':         return { type: 'gender', value: 'male' }
    case 'biologicalSex':  return { type: 'biologicalSex', value: 'male' }
    case 'ageRange':       return { type: 'ageRange' }
    case 'hasVaccine':     return { type: 'hasVaccine', vaccineName: '' }
    case 'missingVaccine': return { type: 'missingVaccine', vaccineName: '' }
  }
}

function TargetingEditor({ targets, onChange }: { targets: NotificationTarget[]; onChange: (t: NotificationTarget[]) => void }) {
  const hasAll = targets.some(t => t.type === 'all')
  function setRule(i: number, r: NotificationTarget) {
    const next = [...targets]; next[i] = r
    onChange(r.type === 'all' ? [r] : next)
  }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Audience</p>
      <div className="flex flex-col gap-2">
        {targets.map((rule, i) => (
          <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <select value={rule.type} onChange={e => setRule(i, blankRule(e.target.value as RuleType))}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none">
                <option value="all">All users</option>
                <option value="location">By location</option>
                <option value="gender">By gender</option>
                <option value="biologicalSex">By biological sex</option>
                <option value="ageRange">By age range</option>
                <option value="hasVaccine">Has vaccine</option>
                <option value="missingVaccine">Missing vaccine</option>
              </select>
              {i > 0 && <button onClick={() => onChange(targets.filter((_, idx) => idx !== i))} className="text-xs text-red-500 font-medium">Remove</button>}
            </div>
            {rule.type === 'location' && (
              <input type="text" placeholder="Country codes, comma-separated (e.g. AU,NZ,GB)"
                value={rule.countries.join(',')}
                onChange={e => setRule(i, { type: 'location', countries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className={inputCls} />
            )}
            {(rule.type === 'gender' || rule.type === 'biologicalSex') && (
              <select value={rule.value} onChange={e => setRule(i, { type: rule.type as 'gender' | 'biologicalSex', value: e.target.value })} className={inputCls}>
                <option value="male">Male</option><option value="female">Female</option>
                {rule.type === 'gender' && <option value="non-binary">Non-binary</option>}
                {rule.type === 'biologicalSex' && <option value="intersex">Intersex</option>}
              </select>
            )}
            {rule.type === 'ageRange' && (
              <div className="flex gap-2">
                <input type="number" placeholder="Min age" min={0} value={rule.minAge ?? ''} className={inputCls}
                  onChange={e => setRule(i, { type: 'ageRange', minAge: e.target.value ? +e.target.value : undefined, maxAge: rule.maxAge })} />
                <input type="number" placeholder="Max age" min={0} value={rule.maxAge ?? ''} className={inputCls}
                  onChange={e => setRule(i, { type: 'ageRange', minAge: rule.minAge, maxAge: e.target.value ? +e.target.value : undefined })} />
              </div>
            )}
            {(rule.type === 'hasVaccine' || rule.type === 'missingVaccine') && (
              <input type="text" placeholder="Vaccine name (e.g. COVID-19, Yellow Fever)" value={rule.vaccineName}
                onChange={e => setRule(i, { type: rule.type as 'hasVaccine' | 'missingVaccine', vaccineName: e.target.value })}
                className={inputCls} />
            )}
          </div>
        ))}
      </div>
      {!hasAll && (
        <button onClick={() => onChange([...targets, blankRule('location')])} className="mt-2 text-xs text-blue-500 font-medium">+ Add rule</button>
      )}
    </div>
  )
}

// ─── News section ──────────────────────────────────────────────────────────────
type NewsForm = {
  title: string; body: string; imageUrl: string; actionUrl: string
  actionLabel: string; targets: NotificationTarget[]
  status: 'active' | 'archived'; publishedAt: string
}

function blankNewsForm(): NewsForm {
  return { title: '', body: '', imageUrl: '', actionUrl: '', actionLabel: 'Read more', targets: [{ type: 'all' }], status: 'active', publishedAt: new Date().toISOString().slice(0, 10) }
}

function NewsSection({ isLg }: { isLg: boolean }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<NewsFeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<NewsForm>(blankNewsForm())
  const [saving, setSaving] = useState(false)

  const showDetail = isNew || selectedId !== null
  const selectedPost = posts.find(p => p.id === selectedId) ?? null

  async function load() {
    setLoading(true)
    const data = await getAllNewsPosts().catch(() => [])
    setPosts(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() { setIsNew(true); setSelectedId(null); setForm(blankNewsForm()) }
  function openEdit(p: NewsFeedPost) {
    setIsNew(false); setSelectedId(p.id)
    setForm({ title: p.title, body: p.body, imageUrl: p.imageUrl ?? '', actionUrl: p.actionUrl ?? '', actionLabel: p.actionLabel ?? 'Read more', targets: p.targets, status: p.status === 'pending' ? 'active' : p.status, publishedAt: p.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10) })
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  async function handleSave() {
    if (!user || !form.title || !form.body) return
    setSaving(true)
    try {
      const payload = clean({
        ...form,
        publishedAt: new Date(form.publishedAt).toISOString(),
        imageUrl: form.imageUrl || undefined,
        actionUrl: form.actionUrl || undefined,
        actionLabel: form.actionLabel || undefined,
        createdBy: user.uid,
        // Only queue push on first activation; skip re-sends on edits
        ...(form.status === 'active' && !selectedId ? { pushSent: false } : {}),
      })
      if (selectedId) await updateNewsPost(selectedId, payload)
      else await createNewsPost(payload)
      closeDetail(); await load()
    } catch (e: unknown) {
      console.error(e)
      const code = (e as { code?: string })?.code
      const msg = (e as Error)?.message ?? String(e)
      alert(code === 'permission-denied' ? 'Permission denied — check Admins collection.' : `Save failed: ${msg}`)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this post?')) return
    await deleteNewsPost(id)
    if (selectedId === id) closeDetail()
    setPosts(p => p.filter(x => x.id !== id))
  }

  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      <button onClick={openNew} className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">+ New post</button>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No posts yet.</p>
      ) : posts.map(p => (
        <div key={p.id} onClick={() => openEdit(p)}
          className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
            selectedId === p.id ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200'
          }`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug truncate">{p.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{p.body}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <p className="flex-1 text-xs text-gray-300 dark:text-gray-600">{fmtDate(p.publishedAt)}</p>
            <button onClick={e => handleDelete(p.id, e)} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )

  const editForm = selectedPost || isNew ? (
    <div className="p-4 lg:p-6">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
      )}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{isNew ? 'New Post' : 'Edit Post'}</h3>
      <div className="flex flex-col gap-3">
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Headline" className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Body *</label>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className={inputCls + ' resize-none'} /></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Publish date</label>
          <input type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Image URL</label>
          <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Link URL</label>
            <input value={form.actionUrl} onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} placeholder="https://…" className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Button label</label>
            <input value={form.actionLabel} onChange={e => setForm(f => ({ ...f, actionLabel: e.target.value }))} placeholder="Read more" className={inputCls} /></div>
        </div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'archived' }))} className={inputCls}>
            <option value="active">Active</option><option value="archived">Archived</option>
          </select></div>
        <TargetingEditor targets={form.targets} onChange={targets => setForm(f => ({ ...f, targets }))} />
        <div className="flex gap-2 pt-2">
          <button onClick={closeDetail} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.body}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Post'}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
      <p className="font-medium">Select a post to edit</p>
      <p className="text-sm mt-1">or click + New post to create one</p>
    </div>
  )

  if (isLg) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">{listPanel}</div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">{editForm}</div>
      </div>
    )
  }
  return <div className="flex-1">{showDetail ? editForm : listPanel}</div>
}

// ─── Sponsored section ─────────────────────────────────────────────────────────
type SponsoredForm = {
  badge: SponsoredBadge; title: string; body: string; imageUrl: string
  actionUrl: string; actionLabel: string; sponsorTag: string
  priority: number; targets: NotificationTarget[]; status: 'active' | 'archived'
}
function blankSponsoredForm(): SponsoredForm {
  return { badge: 'Health Tip', title: '', body: '', imageUrl: '', actionUrl: '', actionLabel: 'Learn more', sponsorTag: '', priority: 0, targets: [{ type: 'all' }], status: 'active' }
}

function SponsoredSection({ isLg }: { isLg: boolean }) {
  const [items, setItems] = useState<SponsoredContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<SponsoredForm>(blankSponsoredForm())
  const [saving, setSaving] = useState(false)

  const showDetail = isNew || selectedId !== null

  async function load() {
    setLoading(true)
    const data = await getAllSponsoredContent().catch(() => [])
    setItems(data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() { setIsNew(true); setSelectedId(null); setForm(blankSponsoredForm()) }
  function openEdit(s: SponsoredContent) {
    setIsNew(false); setSelectedId(s.id)
    setForm({ badge: s.badge, title: s.title, body: s.body, imageUrl: s.imageUrl ?? '', actionUrl: s.actionUrl ?? '', actionLabel: s.actionLabel ?? 'Learn more', sponsorTag: s.sponsorTag ?? '', priority: s.priority, targets: s.targets, status: s.status })
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  async function handleSave() {
    if (!form.title || !form.body) return
    setSaving(true)
    try {
      const payload = clean({ ...form, imageUrl: form.imageUrl || undefined, actionUrl: form.actionUrl || undefined, actionLabel: form.actionLabel || undefined, sponsorTag: form.sponsorTag || undefined })
      if (selectedId) await updateSponsoredContent(selectedId, payload)
      else await createSponsoredContent(payload)
      closeDetail(); await load()
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code; const msg = (e as Error)?.message ?? String(e)
      alert(code === 'permission-denied' ? 'Permission denied — check Admins collection.' : `Save failed: ${msg}`)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this?')) return
    await deleteSponsoredContent(id)
    if (selectedId === id) closeDetail()
    setItems(i => i.filter(x => x.id !== id))
  }

  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      <button onClick={openNew} className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">+ New content</button>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No promoted content yet.</p>
      ) : items.map(s => (
        <div key={s.id} onClick={() => openEdit(s)}
          className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
            selectedId === s.id ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200'
          }`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{s.badge}</span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{s.title}</p>
              <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{s.body}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <p className="flex-1 text-xs text-gray-300 dark:text-gray-600">Priority {s.priority}</p>
            <button onClick={e => handleDelete(s.id, e)} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )

  const editForm = showDetail ? (
    <div className="p-4 lg:p-6">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
      )}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{isNew ? 'New Promoted Content' : 'Edit Content'}</h3>
      <div className="flex flex-col gap-3">
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Badge label</label>
          <select value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value as SponsoredBadge }))} className={inputCls}>
            {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Eye-catching headline" className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Body *</label>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} className={inputCls + ' resize-none'} /></div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Image URL</label>
          <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Link URL</label>
            <input value={form.actionUrl} onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} placeholder="https://…" className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Button label</label>
            <input value={form.actionLabel} onChange={e => setForm(f => ({ ...f, actionLabel: e.target.value }))} placeholder="Learn more" className={inputCls} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Priority</label>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Attribution</label>
            <input value={form.sponsorTag} onChange={e => setForm(f => ({ ...f, sponsorTag: e.target.value }))} placeholder="e.g. Health Authority" className={inputCls} /></div>
        </div>
        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'archived' }))} className={inputCls}>
            <option value="active">Active</option><option value="archived">Archived</option>
          </select></div>
        <TargetingEditor targets={form.targets} onChange={targets => setForm(f => ({ ...f, targets }))} />
        <div className="flex gap-2 pt-2">
          <button onClick={closeDetail} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.body}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p className="font-medium">Select content to edit</p>
      <p className="text-sm mt-1">or click + New content to create</p>
    </div>
  )

  if (isLg) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">{listPanel}</div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">{editForm}</div>
      </div>
    )
  }
  return <div className="flex-1">{showDetail ? editForm : listPanel}</div>
}

// ─── Crawler Queue section ─────────────────────────────────────────────────────

const SOURCE_COLOURS: Record<string, string> = {
  WHO:          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CDC:          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Google News':'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

function CrawlerQueueSection({ isLg, onPendingCount }: { isLg: boolean; onPendingCount: (n: number) => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<NewsFeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveForm, setApproveForm] = useState<NewsForm | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const data = await getPendingNewsPosts().catch(() => [])
    setItems(data)
    onPendingCount(data.length)
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openApprove(p: NewsFeedPost) {
    setApprovingId(p.id)
    setApproveForm({
      title: p.title,
      body: p.body,
      imageUrl: p.imageUrl ?? '',
      actionUrl: p.actionUrl ?? '',
      actionLabel: p.actionLabel ?? 'Read more',
      targets: p.targets ?? [{ type: 'all' }],
      status: 'active',
      publishedAt: p.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    })
  }

  async function handleApprove() {
    if (!user || !approvingId || !approveForm) return
    setSaving(true)
    try {
      await updateNewsPost(approvingId, clean({
        ...approveForm,
        publishedAt: new Date(approveForm.publishedAt).toISOString(),
        imageUrl: approveForm.imageUrl || undefined,
        actionUrl: approveForm.actionUrl || undefined,
        actionLabel: approveForm.actionLabel || undefined,
        // Flag for process-notifications: send push to targeted users
        pushSent: false,
      }))
      setApprovingId(null)
      setApproveForm(null)
      await load()
    } catch (e: unknown) {
      alert(`Approve failed: ${(e as Error)?.message ?? String(e)}`)
    } finally { setSaving(false) }
  }

  async function handleReject(id: string) {
    if (!confirm('Reject and delete this crawled item?')) return
    await deleteNewsPost(id)
    setItems(prev => prev.filter(x => x.id !== id))
    onPendingCount(items.length - 1)
    if (approvingId === id) { setApprovingId(null); setApproveForm(null) }
  }

  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Queue is empty</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The crawler adds items here every 6 hours</p>
        </div>
      ) : items.map(p => (
        <div key={p.id}
          onClick={() => openApprove(p)}
          className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border cursor-pointer transition-all active:scale-[0.98] overflow-hidden ${
            approvingId === p.id ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200'
          }`}
        >
          {/* Thumbnail strip when image available */}
          {p.imageUrl && (
            <img src={p.imageUrl} alt="" className="w-full h-32 object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
          <div className="p-4">
            <div className="flex items-start gap-2 mb-2">
              {p.source && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${SOURCE_COLOURS[p.source] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.source}
                </span>
              )}
              {p.badge && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
                  {p.badge}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{p.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.body}</p>
            <div className="flex items-center gap-2 mt-3">
              <p className="flex-1 text-xs text-gray-300 dark:text-gray-600">
                {p.crawledAt ? `Crawled ${fmtDate(p.crawledAt)}` : fmtDate(p.publishedAt)}
              </p>
              <button
                onClick={e => { e.stopPropagation(); handleReject(p.id) }}
                className="text-xs font-medium text-red-500 hover:text-red-700"
              >Reject</button>
              <button
                onClick={e => { e.stopPropagation(); openApprove(p) }}
                className="text-xs font-semibold text-green-600 hover:text-green-800"
              >Review →</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const approvePanel = approvingId && approveForm ? (
    <div className="p-4 lg:p-6">
      {!isLg && (
        <button onClick={() => { setApprovingId(null); setApproveForm(null) }}
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Review Crawled Article</h3>
      {items.find(i => i.id === approvingId)?.sourceUrl && (
        <a href={items.find(i => i.id === approvingId)!.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline break-all mb-4 block">
          {items.find(i => i.id === approvingId)!.sourceUrl}
        </a>
      )}
      <div className="flex flex-col gap-3">
        {/* Image preview */}
        {approveForm.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <img src={approveForm.imageUrl} alt=""
              className="w-full h-48 object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }} />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Image URL</label>
          <input value={approveForm.imageUrl} onChange={e => setApproveForm(f => f ? { ...f, imageUrl: e.target.value } : f)} placeholder="https://… (auto-fetched from article)" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Title</label>
          <input value={approveForm.title} onChange={e => setApproveForm(f => f ? { ...f, title: e.target.value } : f)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Body</label>
          <textarea value={approveForm.body} onChange={e => setApproveForm(f => f ? { ...f, body: e.target.value } : f)}
            rows={4} className={inputCls + ' resize-none'} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Publish date</label>
          <input type="date" value={approveForm.publishedAt} onChange={e => setApproveForm(f => f ? { ...f, publishedAt: e.target.value } : f)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Link URL</label>
            <input value={approveForm.actionUrl} onChange={e => setApproveForm(f => f ? { ...f, actionUrl: e.target.value } : f)} placeholder="https://…" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Button label</label>
            <input value={approveForm.actionLabel} onChange={e => setApproveForm(f => f ? { ...f, actionLabel: e.target.value } : f)} placeholder="Read more" className={inputCls} />
          </div>
        </div>
        <TargetingEditor targets={approveForm.targets} onChange={targets => setApproveForm(f => f ? { ...f, targets } : f)} />
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleReject(approvingId)}
            className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 font-medium"
          >Reject</button>
          <button
            onClick={handleApprove}
            disabled={saving || !approveForm.title || !approveForm.body}
            className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-green-700"
          >{saving ? 'Publishing…' : '✓ Approve & Publish'}</button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="font-medium">Select an article to review</p>
      <p className="text-sm mt-1">Edit the AI summary and targeting, then approve</p>
    </div>
  )

  if (isLg) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">{listPanel}</div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">{approvePanel}</div>
      </div>
    )
  }
  return <div className="flex-1">{approvingId ? approvePanel : listPanel}</div>
}

// ─── Main page ─────────────────────────────────────────────────────────────────
type SubTab = 'news' | 'promoted' | 'crawler'

export function AdminFeedPage() {
  const isLg = useIsLg()
  const [tab, setTab] = useState<SubTab>('news')
  const [pendingCount, setPendingCount] = useState(0)

  const tabLabels: Record<SubTab, string> = {
    news:    isLg ? 'News Posts'       : 'News',
    promoted:isLg ? 'Promoted Content' : 'Promoted',
    crawler: isLg ? 'Crawler Queue'    : 'Crawler',
  }

  const tabBar = (
    <div className={`flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0`}>
      {(['news', 'promoted', 'crawler'] as SubTab[]).map(t => (
        <button key={t} onClick={() => setTab(t)}
          className={`relative px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
          {tabLabels[t]}
          {t === 'crawler' && pendingCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  if (isLg) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {tabBar}
        <div className="flex flex-1 overflow-hidden">
          {tab === 'news'     && <NewsSection isLg={true} />}
          {tab === 'promoted' && <SponsoredSection isLg={true} />}
          {tab === 'crawler'  && <CrawlerQueueSection isLg={true} onPendingCount={setPendingCount} />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {tabBar}
      {tab === 'news'     && <NewsSection isLg={false} />}
      {tab === 'promoted' && <SponsoredSection isLg={false} />}
      {tab === 'crawler'  && <CrawlerQueueSection isLg={false} onPendingCount={setPendingCount} />}
    </div>
  )
}
