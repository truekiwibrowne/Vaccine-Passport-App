import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { getDependents, getDependentVaccines } from '../services/dependentsService'
import { getPets, getPetVaccines } from '../services/petsService'
import { getFarmAnimals, getFarmVaccines } from '../services/farmService'
import {
  getCalendarEvents, addCalendarEvent, deleteCalendarEvent,
  CUSTOM_EVENT_LABELS, CUSTOM_EVENT_EMOJI,
  type CalendarCustomEvent, type CustomEventType,
} from '../services/calendarEventsService'
import type { UserVaccine } from '../types/vaccine'
import type { Dependent } from '../types/dependent'
import type { Pet, PetVaccine } from '../types/pet'
import type { FarmAnimal, FarmVaccine } from '../types/farm'
import { PET_SPECIES_EMOJI } from '../types/pet'
import { FARM_SPECIES_EMOJI } from '../types/farm'

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month' | 'year'

interface CalEvent {
  id: string
  date: string
  name: string
  type: 'admin' | 'expiry' | 'custom'
  sourceKey: string
  colorIdx: number
  sourceLabel: string
  sourceEmoji: string
  navPath: string
  customEventId?: string
  customEventType?: CustomEventType
}

interface Source {
  key: string
  label: string
  emoji: string
  colorIdx: number
}

// ── Colours ───────────────────────────────────────────────────────────────────

const COLORS = [
  { dot: 'bg-blue-500',   chip: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300' },
  { dot: 'bg-indigo-500', chip: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  { dot: 'bg-green-500',  chip: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-700 dark:text-green-300' },
  { dot: 'bg-purple-500', chip: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { dot: 'bg-teal-500',   chip: 'bg-teal-100 dark:bg-teal-900/30',    text: 'text-teal-700 dark:text-teal-300' },
  { dot: 'bg-rose-500',   chip: 'bg-rose-100 dark:bg-rose-900/30',    text: 'text-rose-700 dark:text-rose-300' },
  { dot: 'bg-amber-500',  chip: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300' },
  { dot: 'bg-cyan-500',   chip: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-300' },
]

function colorFor(idx: number) { return COLORS[idx % COLORS.length] }

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getWeekDates(anchor: Date): Date[] {
  const start = new Date(anchor)
  start.setDate(anchor.getDate() - anchor.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getMonthCells(y: number, m: number): (Date | null)[] {
  const first = new Date(y, m, 1)
  const last  = new Date(y, m + 1, 0)
  const cells: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d))
  return cells
}

// ── ICS export ────────────────────────────────────────────────────────────────

function generateICS(events: CalEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VacciPass//Vaccine Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const ev of events) {
    const ds = ev.date.replace(/-/g, '')
    const nextD = new Date(parseLocalDate(ev.date).getTime() + 86_400_000)
    const de = dateKey(nextD).replace(/-/g, '')
    const summary = ev.type === 'custom'
      ? `${CUSTOM_EVENT_EMOJI[ev.customEventType ?? 'other']} ${ev.name}`
      : ev.type === 'expiry'
        ? `⚠ Expires: ${ev.name}`
        : `💉 Administered: ${ev.name}`
    const desc = ev.type === 'custom'
      ? `${CUSTOM_EVENT_LABELS[ev.customEventType ?? 'other']}`
      : `${ev.sourceLabel} · ${ev.type === 'expiry' ? 'Vaccine expires' : 'Vaccine administered'}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@vaccipass`,
      `DTSTART;VALUE=DATE:${ds}`,
      `DTEND;VALUE=DATE:${de}`,
      `SUMMARY:${summary.replace(/,/g, '\\,')}`,
      `DESCRIPTION:${desc.replace(/,/g, '\\,')}`,
      `CATEGORIES:${ev.type === 'expiry' ? 'VACCINE EXPIRY' : ev.type === 'custom' ? 'CUSTOM EVENT' : 'VACCINATION'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function downloadICS(events: CalEvent[]) {
  const content = generateICS(events)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'vaccipass-calendar.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Exported helper used by HomePage tile ─────────────────────────────────────

export function getUpcomingExpiries(vaccines: UserVaccine[], withinDays: number): Array<{ name: string; daysLeft: number }> {
  const now      = new Date()
  const todayKey = dateKey(now)
  const cutoff   = new Date(now)
  cutoff.setDate(cutoff.getDate() + withinDays)
  const cutoffKey = dateKey(cutoff)
  return vaccines
    .filter(v => {
      if (!v.Expiration_date) return false
      const k = v.Expiration_date.slice(0, 10)
      return k >= todayKey && k <= cutoffKey
    })
    .map(v => {
      const exp     = parseLocalDate(v.Expiration_date!)
      const daysLeft = Math.round((exp.getTime() - parseLocalDate(todayKey).getTime()) / 86_400_000)
      return { name: v.vaccine_name, daysLeft }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_INITIALS  = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_LABELS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CUSTOM_CHIP   = 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
const CUSTOM_DOT    = 'bg-violet-500'

// ── Add Event Modal ───────────────────────────────────────────────────────────

interface AddEventModalProps {
  initialDate?: string
  onClose: () => void
  onSave: (data: { title: string; date: string; eventType: CustomEventType; notes: string }) => Promise<void>
}

function AddEventModal({ initialDate, onClose, onSave }: AddEventModalProps) {
  const today = dateKey(new Date())
  const [title, setTitle]           = useState('')
  const [date, setDate]             = useState(initialDate ?? today)
  const [eventType, setEventType]   = useState<CustomEventType>('appointment')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  async function handleSave() {
    if (!title.trim()) { setErr('Title is required'); return }
    if (!date)         { setErr('Date is required');  return }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), date, eventType, notes: notes.trim() })
      onClose()
    } catch {
      setErr('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Event</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <IconX className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Vet appointment — Bessie"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value as CustomEventType)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(CUSTOM_EVENT_LABELS) as CustomEventType[]).map(t => (
                  <option key={t} value={t}>{CUSTOM_EVENT_EMOJI[t]} {CUSTOM_EVENT_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const navigate              = useNavigate()
  const { user, profile }     = useAuth()
  const { isDark }            = useTheme()
  const { vaccines: selfVaccines } = useUserVaccines(user?.uid)

  const isFarmMode = profile?.appMode === 'farm'

  const [view, setView]             = useState<ViewMode>('month')
  const [anchor, setAnchor]         = useState<Date>(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalDate, setAddModalDate] = useState<string | undefined>(undefined)

  // Personal mode data
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [depVax, setDepVax]         = useState<Record<string, UserVaccine[]>>({})
  const [pets, setPets]             = useState<Pet[]>([])
  const [petVax, setPetVax]         = useState<Record<string, PetVaccine[]>>({})

  // Farm mode data
  const [farmAnimals, setFarmAnimals]   = useState<FarmAnimal[]>([])
  const [farmVax, setFarmVax]           = useState<Record<string, FarmVaccine[]>>({})

  // Custom events (all modes)
  const [customEvents, setCustomEvents] = useState<CalendarCustomEvent[]>([])

  const [enabled, setEnabled] = useState<Set<string>>(new Set(['self', 'custom']))

  // Load data based on mode
  useEffect(() => {
    if (!user) return

    // Always load custom events
    getCalendarEvents(user.uid)
      .then(setCustomEvents)
      .catch(() => {})

    if (isFarmMode) {
      getFarmAnimals(user.uid).then(animals => {
        setFarmAnimals(animals)
        // Build initial enabled set — one entry per herd
        const herds = Array.from(new Set(animals.map(a => a.herd ?? 'Ungrouped')))
        setEnabled(new Set(['custom', ...herds.map(h => `herd_${h}`)]))
        // Load vaccines for every animal
        animals.forEach(animal =>
          getFarmVaccines(user.uid, animal.id)
            .then(vs => setFarmVax(p => ({ ...p, [animal.id]: vs })))
            .catch(() => {})
        )
      })
    } else {
      setEnabled(new Set(['self', 'custom']))
      getDependents(user.uid).then(deps => {
        setDependents(deps)
        setEnabled(p => { const n = new Set(p); deps.forEach(d => n.add(`dep_${d.id}`)); return n })
        deps.forEach(dep =>
          getDependentVaccines(user.uid, dep.id).then(vs =>
            setDepVax(p => ({ ...p, [dep.id]: vs }))
          )
        )
      })
      getPets(user.uid).then(pts => {
        setPets(pts)
        setEnabled(p => { const n = new Set(p); pts.forEach(pt => n.add(`pet_${pt.id}`)); return n })
        pts.forEach(pet =>
          getPetVaccines(user.uid, pet.id).then(vs =>
            setPetVax(p => ({ ...p, [pet.id]: vs }))
          )
        )
      })
    }
  }, [user, isFarmMode])

  // ── Sources ─────────────────────────────────────────────────────────────────

  const sources: Source[] = useMemo(() => {
    const list: Source[] = []

    if (isFarmMode) {
      const herds = Array.from(
        new Map(
          farmAnimals.map(a => [a.herd ?? 'Ungrouped', a.species])
        ).entries()
      )
      herds.forEach(([herd, species], i) => {
        list.push({
          key:      `herd_${herd}`,
          label:    herd,
          emoji:    FARM_SPECIES_EMOJI[species] ?? '🐾',
          colorIdx: i,
        })
      })
    } else {
      list.push({ key: 'self', label: 'Me', emoji: '👤', colorIdx: 0 })
      dependents.forEach((dep, i) =>
        list.push({ key: `dep_${dep.id}`, label: dep.name, emoji: '👶', colorIdx: i + 1 })
      )
      pets.forEach((pet, i) =>
        list.push({
          key:      `pet_${pet.id}`,
          label:    pet.name,
          emoji:    PET_SPECIES_EMOJI[pet.species] ?? '🐾',
          colorIdx: dependents.length + 1 + i,
        })
      )
    }

    // Custom events always last
    list.push({ key: 'custom', label: 'My Events', emoji: '📌', colorIdx: list.length })
    return list
  }, [isFarmMode, farmAnimals, dependents, pets])

  // ── Build events ─────────────────────────────────────────────────────────────

  const allEvents: CalEvent[] = useMemo(() => {
    const events: CalEvent[] = []

    const pushVaccine = (
      v: UserVaccine,
      sourceKey: string, colorIdx: number, sourceLabel: string, sourceEmoji: string,
      navPath: string,
    ) => {
      if (v.date_administration) events.push({
        id: `admin_${v.user_vaccine_id}`,
        date: v.date_administration.slice(0, 10),
        name: v.vaccine_name, type: 'admin',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
      if (v.Expiration_date) events.push({
        id: `exp_${v.user_vaccine_id}`,
        date: v.Expiration_date.slice(0, 10),
        name: v.vaccine_name, type: 'expiry',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
    }

    const pushPetVaccine = (v: PetVaccine, petId: string, sourceKey: string, colorIdx: number, sourceLabel: string, sourceEmoji: string) => {
      const navPath = `/pets/${petId}/vaccines/${v.pet_vaccine_id}`
      if (v.date_administration) events.push({
        id: `admin_${v.pet_vaccine_id}`,
        date: v.date_administration.slice(0, 10),
        name: v.vaccine_name, type: 'admin',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
      if (v.Expiration_date) events.push({
        id: `exp_${v.pet_vaccine_id}`,
        date: v.Expiration_date.slice(0, 10),
        name: v.vaccine_name, type: 'expiry',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
    }

    const pushFarmVaccine = (v: FarmVaccine, animal: FarmAnimal, sourceKey: string, colorIdx: number, sourceLabel: string, sourceEmoji: string) => {
      const label  = animal.tagNumber + (animal.name ? ` · ${animal.name}` : '')
      const navPath = `/farm`
      if (v.date_administration) events.push({
        id: `admin_${v.farm_vaccine_id}`,
        date: v.date_administration.slice(0, 10),
        name: `${label}: ${v.vaccine_name}`, type: 'admin',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
      if (v.Expiration_date) events.push({
        id: `exp_${v.farm_vaccine_id}`,
        date: v.Expiration_date.slice(0, 10),
        name: `${label}: ${v.vaccine_name}`, type: 'expiry',
        sourceKey, colorIdx, sourceLabel, sourceEmoji, navPath,
      })
    }

    if (isFarmMode) {
      farmAnimals.forEach(animal => {
        const herd      = animal.herd ?? 'Ungrouped'
        const sourceKey = `herd_${herd}`
        if (!enabled.has(sourceKey)) return
        const src = sources.find(s => s.key === sourceKey)
        if (!src) return
        const vs = farmVax[animal.id] ?? []
        vs.forEach(v => pushFarmVaccine(v, animal, sourceKey, src.colorIdx, src.label, src.emoji))
      })
    } else {
      const selfSrc = sources.find(s => s.key === 'self')
      if (selfSrc && enabled.has('self')) {
        selfVaccines.forEach(v =>
          pushVaccine(v, 'self', selfSrc.colorIdx, selfSrc.label, selfSrc.emoji,
            `/vaccines/${v.user_vaccine_id}`)
        )
      }
      dependents.forEach(dep => {
        const key = `dep_${dep.id}`
        if (!enabled.has(key)) return
        const src = sources.find(s => s.key === key)
        if (!src) return
        ;(depVax[dep.id] ?? []).forEach(v =>
          pushVaccine(v, key, src.colorIdx, src.label, src.emoji,
            `/dependents/${dep.id}/vaccines/${v.user_vaccine_id}`)
        )
      })
      pets.forEach(pet => {
        const key = `pet_${pet.id}`
        if (!enabled.has(key)) return
        const src = sources.find(s => s.key === key)
        if (!src) return
        ;(petVax[pet.id] ?? []).forEach(v => pushPetVaccine(v, pet.id, key, src.colorIdx, src.label, src.emoji))
      })
    }

    // Custom events
    if (enabled.has('custom')) {
      customEvents.forEach(ev => {
        events.push({
          id:              `custom_${ev.id}`,
          date:            ev.date,
          name:            ev.title,
          type:            'custom',
          sourceKey:       'custom',
          colorIdx:        0,
          sourceLabel:     CUSTOM_EVENT_LABELS[ev.eventType],
          sourceEmoji:     CUSTOM_EVENT_EMOJI[ev.eventType],
          navPath:         '',
          customEventId:   ev.id,
          customEventType: ev.eventType,
        })
      })
    }

    return events
  }, [isFarmMode, selfVaccines, dependents, depVax, pets, petVax, farmAnimals, farmVax, customEvents, enabled, sources])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    allEvents.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [allEvents])

  const todayKey = dateKey(new Date())

  // ── Navigation ───────────────────────────────────────────────────────────────

  function navigatePrev() {
    const d = new Date(anchor)
    if (view === 'week')  d.setDate(d.getDate() - 7)
    else if (view === 'month') d.setMonth(d.getMonth() - 1)
    else d.setFullYear(d.getFullYear() - 1)
    setAnchor(d); setSelectedDay(null)
  }
  function navigateNext() {
    const d = new Date(anchor)
    if (view === 'week')  d.setDate(d.getDate() + 7)
    else if (view === 'month') d.setMonth(d.getMonth() + 1)
    else d.setFullYear(d.getFullYear() + 1)
    setAnchor(d); setSelectedDay(null)
  }
  function goToToday() {
    setAnchor(new Date()); setSelectedDay(todayKey)
  }

  function periodLabel(): string {
    if (view === 'year') return String(anchor.getFullYear())
    if (view === 'month') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    const week = getWeekDates(anchor)
    const s = week[0], e = week[6]
    if (s.getMonth() === e.getMonth())
      return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
    if (s.getFullYear() === e.getFullYear())
      return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTH_SHORT[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
    return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTH_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
  }

  function toggleSource(key: string) {
    setEnabled(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Save / delete custom events ───────────────────────────────────────────────

  const handleSaveEvent = useCallback(async (data: { title: string; date: string; eventType: CustomEventType; notes: string }) => {
    if (!user) return
    const id = await addCalendarEvent(user.uid, data)
    const newEv: CalendarCustomEvent = {
      id,
      title: data.title,
      date: data.date,
      eventType: data.eventType,
      notes: data.notes || undefined,
      ownerId: user.uid,
      Created: new Date().toISOString(),
      Updated: new Date().toISOString(),
    }
    setCustomEvents(p => [...p, newEv].sort((a, b) => a.date.localeCompare(b.date)))
  }, [user])

  const handleDeleteCustomEvent = useCallback(async (customEventId: string) => {
    await deleteCalendarEvent(customEventId)
    setCustomEvents(p => p.filter(e => e.id !== customEventId))
  }, [])

  // ── Event chip component ──────────────────────────────────────────────────────

  function EventChip({ ev, compact = false }: { ev: CalEvent; compact?: boolean }) {
    const cls = `text-[10px] leading-snug px-1.5 py-px rounded truncate flex items-center gap-1`
    if (ev.type === 'expiry') return (
      <div className={`${cls} bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
        <span className="truncate">{compact ? ev.name.split(':').pop()?.trim() ?? ev.name : ev.name}</span>
      </div>
    )
    if (ev.type === 'custom') return (
      <div className={`${cls} ${CUSTOM_CHIP}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${CUSTOM_DOT} flex-shrink-0`} />
        <span className="truncate">{ev.name}</span>
      </div>
    )
    const c = colorFor(ev.colorIdx)
    return (
      <div className={`${cls} ${c.chip} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
        <span className="truncate">{compact ? ev.name.split(':').pop()?.trim() ?? ev.name : ev.name}</span>
      </div>
    )
  }

  // ── View sub-components ───────────────────────────────────────────────────────

  function MonthView() {
    const y = anchor.getFullYear()
    const m = anchor.getMonth()
    const cells = getMonthCells(y, m)

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`null_${i}`} className="min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50" />
            const key     = dateKey(cell)
            const evs     = eventsByDate[key] ?? []
            const isToday = key === todayKey
            const isSel   = key === selectedDay
            const inMonth = cell.getMonth() === m
            return (
              <div
                key={key}
                onClick={() => setSelectedDay(prev => prev === key ? null : key)}
                className={`min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 p-1 cursor-pointer transition-colors
                  ${isSel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}
                  ${!inMonth ? 'opacity-40' : ''}`}
              >
                <div className="flex justify-end mb-1">
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {cell.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {evs.slice(0, 2).map(ev => <EventChip key={ev.id} ev={ev} compact={isFarmMode} />)}
                  {evs.length > 2 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">+{evs.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function WeekView() {
    const days = getWeekDates(anchor)
    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {days.map(d => {
            const key = dateKey(d)
            const isToday = key === todayKey
            return (
              <div key={key} className="py-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{DAY_LABELS[d.getDay()]}</div>
                <span className={`text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full mx-auto
                  ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                  {d.getDate()}
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700/50">
          {days.map(d => {
            const key = dateKey(d)
            const evs = eventsByDate[key] ?? []
            return (
              <div
                key={key}
                onClick={() => setSelectedDay(prev => prev === key ? null : key)}
                className="p-1.5 min-h-[200px] flex flex-col gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                {evs.map(ev => (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); if (ev.navPath) navigate(ev.navPath) }}
                    className={ev.navPath ? 'cursor-pointer' : ''}
                  >
                    <EventChip ev={ev} compact={isFarmMode} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function MiniMonth({ y, m }: { y: number; m: number }) {
    const cells = getMonthCells(y, m)
    return (
      <div
        onClick={() => { setView('month'); setAnchor(new Date(y, m, 1)); setSelectedDay(null) }}
        className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 text-center">{MONTH_SHORT[m]}</div>
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_INITIALS.map((l, i) => (
            <div key={i} className="text-[7px] text-center text-gray-400 dark:text-gray-500">{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`null_${i}`} />
            const key  = dateKey(cell)
            const evs  = eventsByDate[key] ?? []
            const isToday = key === todayKey
            return (
              <div key={key} className="flex flex-col items-center py-px">
                <span className={`text-[8px] w-4 h-4 flex items-center justify-center rounded-full leading-none
                  ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                  {cell.getDate()}
                </span>
                {evs.length > 0 && (
                  <div className="flex gap-px mt-px flex-wrap justify-center">
                    {evs.slice(0, 3).map(ev => {
                      if (ev.type === 'expiry') return <span key={ev.id} className="w-1 h-1 rounded-full bg-red-500" />
                      if (ev.type === 'custom') return <span key={ev.id} className="w-1 h-1 rounded-full bg-violet-500" />
                      return <span key={ev.id} className={`w-1 h-1 rounded-full ${colorFor(ev.colorIdx).dot}`} />
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function YearView() {
    const y = anchor.getFullYear()
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 12 }, (_, m) => <MiniMonth key={m} y={y} m={m} />)}
        </div>
      </div>
    )
  }

  // ── Selected day panel ────────────────────────────────────────────────────────

  const selectedEvents  = selectedDay ? (eventsByDate[selectedDay] ?? []) : []
  const selectedDateObj = selectedDay ? parseLocalDate(selectedDay) : null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">

        {/* Title row */}
        <div className="h-14 flex items-center px-4 gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 flex-shrink-0"
          >
            <IconChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white truncate">
            {isFarmMode ? 'Farm Calendar' : 'Vaccine Calendar'}
          </h1>

          {/* Export ICS */}
          <button
            onClick={() => downloadICS(allEvents)}
            title="Export to iCal / Outlook (.ics)"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <IconDownload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>

          {/* Add event */}
          <button
            onClick={() => { setAddModalDate(selectedDay ?? undefined); setShowAddModal(true) }}
            title="Add event"
            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <IconPlus className="w-5 h-5 text-white" />
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-0.5 flex-shrink-0">
            {(['week', 'month', 'year'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDay(null) }}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors capitalize
                  ${view === v
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Period nav row */}
        <div className="flex items-center px-4 py-2 gap-2">
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <IconChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>

          <p className="flex-1 text-center text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {periodLabel()}
          </p>

          {/* Today pill */}
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            Today
          </button>

          <button
            onClick={navigateNext}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <IconChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Source filter chips */}
        {sources.length >= 2 && (
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
            {sources.map(src => {
              const on  = enabled.has(src.key)
              const c   = src.key === 'custom' ? null : colorFor(src.colorIdx)
              const onCls  = src.key === 'custom' ? `${CUSTOM_CHIP} border-transparent` : `${c!.chip} ${c!.text} border-transparent`
              const offCls = 'bg-transparent text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'
              return (
                <button
                  key={src.key}
                  onClick={() => toggleSource(src.key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${on ? onCls : offCls}`}
                >
                  <span>{src.emoji}</span>
                  <span>{src.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Calendar body ── */}
      <div className="flex flex-col">
        {view === 'month' && <MonthView />}
        {view === 'week'  && <WeekView />}
        {view === 'year'  && <YearView />}
      </div>

      {/* ── Selected day panel ── */}
      {selectedDay && selectedDateObj && (
        <div className="mx-4 mt-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setAddModalDate(selectedDay); setShowAddModal(true) }}
                className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
                title="Add event on this day"
              >
                <IconPlus className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <IconX className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No events</p>
              <button
                onClick={() => { setAddModalDate(selectedDay); setShowAddModal(true) }}
                className="mt-2 text-sm font-medium text-blue-500"
              >
                + Add one
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {selectedEvents.map(ev => {
                const isExpiry = ev.type === 'expiry'
                const isCustom = ev.type === 'custom'
                const c = colorFor(ev.colorIdx)
                return (
                  <div
                    key={ev.id}
                    onClick={() => { if (ev.navPath) navigate(ev.navPath) }}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${ev.navPath ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isExpiry ? 'bg-red-500' : isCustom ? CUSTOM_DOT : c.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {isCustom
                          ? `${ev.sourceEmoji} ${ev.sourceLabel}`
                          : isExpiry
                            ? `⚠ Expires · ${ev.sourceEmoji} ${ev.sourceLabel}`
                            : `💉 Administered · ${ev.sourceEmoji} ${ev.sourceLabel}`}
                      </div>
                    </div>
                    {isCustom && ev.customEventId && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCustomEvent(ev.customEventId!) }}
                        className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                        title="Delete event"
                      >
                        <IconTrash className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                    {!isCustom && ev.navPath && (
                      <IconChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="mx-4 mt-4 mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Administered</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Expiry</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" />Custom event</span>
      </div>

      {/* ── Add Event Modal ── */}
      {showAddModal && (
        <AddEventModal
          initialDate={addModalDate}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  )
}
