import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { ScheduledNotification, NotificationTarget, NotificationStatus } from '../types/admin'
import {
  getScheduledNotifications,
  createScheduledNotification,
  updateScheduledNotification,
  deleteScheduledNotification,
  getFCMTokenCount,
} from '../services/notificationsAdminService'
import { useIsLg } from '../hooks/useMediaQuery'

// ── helpers ────────────────────────────────────────────────────────────────────
function statusBadge(status: NotificationStatus) {
  const map: Record<NotificationStatus, string> = {
    draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    sending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    sent:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return map[status] ?? map.draft
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

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

type FormState = {
  title: string; body: string; imageUrl: string; actionUrl: string
  scheduledAt: string; targets: NotificationTarget[]
}

function blankForm(): FormState {
  return { title: '', body: '', imageUrl: '', actionUrl: '', scheduledAt: '', targets: [{ type: 'all' }] }
}

function fromNotif(n: ScheduledNotification): FormState {
  return {
    title: n.title,
    body: n.body,
    imageUrl: n.imageUrl ?? '',
    actionUrl: n.actionUrl ?? '',
    scheduledAt: n.scheduledAt ? new Date(n.scheduledAt).toISOString().slice(0, 16) : '',
    targets: n.targets,
  }
}

// ── Rule editor ────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500'
const selectCls = 'px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function RuleEditor({ rule, index, onChange, onRemove, disableAll }: {
  rule: NotificationTarget; index: number
  onChange: (r: NotificationTarget) => void; onRemove: () => void; disableAll: boolean
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select value={rule.type} onChange={e => onChange(blankRule(e.target.value as RuleType))} className={selectCls}>
          <option value="all" disabled={disableAll && rule.type !== 'all'}>All Users</option>
          <option value="location">By Location</option>
          <option value="gender">By Gender</option>
          <option value="biologicalSex">By Biological Sex</option>
          <option value="ageRange">By Age Range</option>
          <option value="hasVaccine">Has Vaccine</option>
          <option value="missingVaccine">Missing Vaccine</option>
        </select>
        {index > 0 && (
          <button onClick={onRemove} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
        )}
      </div>
      {rule.type === 'location' && (
        <input type="text" placeholder="Country codes, comma-separated (e.g. US,CA,GB)"
          value={rule.countries.join(',')}
          onChange={e => onChange({ type: 'location', countries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className={inputCls} />
      )}
      {rule.type === 'gender' && (
        <select value={rule.value} onChange={e => onChange({ type: 'gender', value: e.target.value })} className={selectCls}>
          <option value="male">Male</option><option value="female">Female</option>
          <option value="non-binary">Non-binary</option><option value="other">Other</option>
        </select>
      )}
      {rule.type === 'biologicalSex' && (
        <select value={rule.value} onChange={e => onChange({ type: 'biologicalSex', value: e.target.value })} className={selectCls}>
          <option value="male">Male</option><option value="female">Female</option><option value="intersex">Intersex</option>
        </select>
      )}
      {rule.type === 'ageRange' && (
        <div className="flex items-center gap-2">
          <input type="number" placeholder="Min age" min={0} value={rule.minAge ?? ''} className={`w-full ${inputCls}`}
            onChange={e => onChange({ type: 'ageRange', minAge: e.target.value ? Number(e.target.value) : undefined, maxAge: rule.maxAge })} />
          <span className="text-gray-400 text-sm">–</span>
          <input type="number" placeholder="Max age" min={0} value={rule.maxAge ?? ''} className={inputCls}
            onChange={e => onChange({ type: 'ageRange', minAge: rule.minAge, maxAge: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      )}
      {(rule.type === 'hasVaccine' || rule.type === 'missingVaccine') && (
        <input type="text" placeholder="Vaccine name (e.g. COVID-19, Yellow Fever)" value={rule.vaccineName}
          onChange={e => onChange({ type: rule.type as 'hasVaccine' | 'missingVaccine', vaccineName: e.target.value })}
          className={inputCls} />
      )}
    </div>
  )
}

// ── Notification form ──────────────────────────────────────────────────────────
function NotifForm({ initial, onSave, onCancel, saving, isNew }: {
  initial: FormState
  onSave: (form: FormState, status: 'draft' | 'scheduled') => Promise<void>
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  // reset when initial changes (switching selected item)
  useEffect(() => { setForm(initial) }, [initial.title])

  const hasAllRule = form.targets.some(t => t.type === 'all')

  function setRule(i: number, r: NotificationTarget) {
    setForm(f => {
      const targets = [...f.targets]
      targets[i] = r
      return r.type === 'all' ? { ...f, targets: [r] } : { ...f, targets }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Title *</label>
        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" className={inputCls} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Message *</label>
        <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Notification body text" rows={3} className={inputCls + ' resize-none'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Image URL</label>
          <input type="url" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Action URL</label>
          <input type="text" value={form.actionUrl} onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} placeholder="/vaccines/add" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Schedule *</label>
        <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className={inputCls} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Target Audience</p>
        <div className="flex flex-col gap-2">
          {form.targets.map((rule, i) => (
            <RuleEditor key={i} rule={rule} index={i}
              onChange={r => setRule(i, r)}
              onRemove={() => setForm(f => ({ ...f, targets: f.targets.filter((_, idx) => idx !== i) }))}
              disableAll={hasAllRule && rule.type !== 'all'}
            />
          ))}
        </div>
        {!hasAllRule && (
          <button onClick={() => setForm(f => ({ ...f, targets: [...f.targets, blankRule('location')] }))}
            className="mt-2 text-sm text-blue-600 font-medium hover:underline">
            + Add Rule
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button onClick={() => onSave(form, 'draft')} disabled={saving || !form.title || !form.body}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          Save Draft
        </button>
        <button onClick={() => onSave(form, 'scheduled')} disabled={saving || !form.title || !form.body || !form.scheduledAt}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : isNew ? 'Schedule' : 'Update'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
type FilterTab = 'all' | NotificationStatus

export function AdminNotificationsPage() {
  const { user } = useAuth()
  const isLg = useIsLg()
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [tokenCount, setTokenCount] = useState<number | null>(null)

  const showDetail = isNew || selectedId !== null
  const selectedNotif = notifications.find(n => n.id === selectedId) ?? null

  async function load() {
    setLoading(true)
    try { setNotifications(await getScheduledNotifications()) }
    catch (e) { console.error('Failed to load notifications:', e) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    getFCMTokenCount().then(setTokenCount).catch(() => setTokenCount(0))
  }, [])

  function openNew() { setIsNew(true); setSelectedId(null) }
  function openEdit(n: ScheduledNotification) {
    if (n.status !== 'draft' && n.status !== 'scheduled') return
    setIsNew(false)
    setSelectedId(n.id)
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  async function handleSave(form: FormState, status: 'draft' | 'scheduled') {
    if (!user) return
    setSaving(true)
    try {
      const scheduledAt = form.scheduledAt ? new Date(form.scheduledAt).toISOString() : new Date().toISOString()
      if (selectedId) {
        await updateScheduledNotification(selectedId, { title: form.title, body: form.body, imageUrl: form.imageUrl || undefined, actionUrl: form.actionUrl || undefined, scheduledAt, targets: form.targets, status })
      } else {
        await createScheduledNotification({ title: form.title, body: form.body, imageUrl: form.imageUrl || undefined, actionUrl: form.actionUrl || undefined, scheduledAt, targets: form.targets, status, createdBy: user.uid })
      }
      closeDetail()
      await load()
    } catch (e) { console.error('Save error:', e); alert('Error saving notification.') }
    finally { setSaving(false) }
  }

  async function handleSendNow(n: ScheduledNotification, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Send "${n.title}" immediately?`)) return
    setSendingId(n.id)
    try {
      const res = await fetch('/.netlify/functions/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: n.id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      alert(`Sent! ${data.sentCount} delivered${data.failedCount ? `, ${data.failedCount} failed` : ''}.`)
      await load()
    } catch (e: unknown) { alert(`Error: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setSendingId(null) }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this notification?')) return
    try {
      await deleteScheduledNotification(id)
      if (selectedId === id) closeDetail()
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch { alert('Error deleting.') }
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'draft', label: 'Draft' },
    { key: 'scheduled', label: 'Scheduled' }, { key: 'sent', label: 'Sent' },
  ]
  const visible = filterTab === 'all' ? notifications : notifications.filter(n => n.status === filterTab)

  // ── List panel ─────────────────────────────────────────────────────────────
  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      {/* Token count */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Registered Devices</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tokenCount === null ? 'Loading…' : tokenCount === 0 ? 'No devices registered yet' : `${tokenCount} device${tokenCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        {tokenCount !== null && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${tokenCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{tokenCount}</span>
        )}
      </div>

      {/* Add button */}
      <button onClick={openNew}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
        + New Notification
      </button>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilterTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(n => (
            <div
              key={n.id}
              onClick={() => openEdit(n)}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border transition-all ${
                (n.status === 'draft' || n.status === 'scheduled') ? 'cursor-pointer active:scale-[0.98]' : ''
              } ${
                selectedId === n.id
                  ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{n.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusBadge(n.status)}`}>{n.status}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{n.body}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(n.scheduledAt)}</p>
              <div className="flex gap-2 mt-2">
                {(n.status === 'draft' || n.status === 'scheduled') && (
                  <button onClick={e => handleSendNow(n, e)} disabled={sendingId === n.id}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {sendingId === n.id ? 'Sending…' : '▶ Send Now'}
                  </button>
                )}
                <button onClick={e => handleDelete(n.id, e)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Detail / edit panel ────────────────────────────────────────────────────
  const formInitial: FormState = selectedNotif ? fromNotif(selectedNotif) : blankForm()

  const detailPanel = showDetail ? (
    <div className="p-4 lg:p-6">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to notifications
        </button>
      )}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        {isNew ? 'New Notification' : 'Edit Notification'}
      </h2>
      <NotifForm
        key={selectedId ?? 'new'}
        initial={formInitial}
        onSave={handleSave}
        onCancel={closeDetail}
        saving={saving}
        isNew={isNew}
      />
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <p className="font-medium">Select a draft or scheduled notification to edit</p>
      <p className="text-sm mt-1">or click + New Notification to create one</p>
    </div>
  )

  // ── Layout ─────────────────────────────────────────────────────────────────
  if (isLg) {
    return (
      <div className="flex flex-1 overflow-hidden border-t border-gray-200 dark:border-gray-700">
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
          {listPanel}
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {detailPanel}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      {showDetail ? detailPanel : listPanel}
    </div>
  )
}
