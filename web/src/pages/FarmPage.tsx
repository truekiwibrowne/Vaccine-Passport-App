import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getFarmAnimals, deleteFarmAnimal, updateFarmAnimal } from '../services/farmService'
import { sendShareInvite } from '../services/sharingService'
import type { FarmAnimal, FarmSpecies, FarmAnimalStatus } from '../types/farm'
import {
  FARM_SPECIES_LABELS, FARM_SPECIES_CODE, ALL_FARM_SPECIES,
  FARM_STATUS_LABELS, IMPORT_TEMPLATE_HEADERS, type FarmImportRow,
} from '../types/farm'
import type { FarmAnimalInput } from '../services/farmService'

// ── Column configuration ──────────────────────────────────────────────────────

type ColKey =
  | 'tag' | 'name' | 'species' | 'breed' | 'sex' | 'dob'
  | 'herd' | 'paddock' | 'chipId' | 'nationalId' | 'weight' | 'purpose'
  | 'status'

interface ColDef {
  key: ColKey
  label: string
  defaultVisible: boolean
  alwaysVisible?: boolean
}

const ALL_COLUMNS: ColDef[] = [
  { key: 'tag',        label: 'Tag',           defaultVisible: true,  alwaysVisible: true },
  { key: 'name',       label: 'Name',          defaultVisible: true  },
  { key: 'species',    label: 'Species',       defaultVisible: true  },
  { key: 'breed',      label: 'Breed',         defaultVisible: true  },
  { key: 'sex',        label: 'Sex',           defaultVisible: true  },
  { key: 'dob',        label: 'Date of Birth', defaultVisible: true  },
  { key: 'herd',       label: 'Herd',          defaultVisible: false },
  { key: 'paddock',    label: 'Paddock',       defaultVisible: false },
  { key: 'chipId',     label: 'Chip ID',       defaultVisible: false },
  { key: 'nationalId', label: 'National ID',   defaultVisible: false },
  { key: 'weight',     label: 'Weight',        defaultVisible: false },
  { key: 'purpose',    label: 'Purpose',       defaultVisible: false },
  { key: 'status',     label: 'Status',        defaultVisible: true,  alwaysVisible: true },
]

// Fixed-width classes per column — same class used in header and cell rows.
// Fixed widths (not flex-1) are required for horizontal scroll to work correctly.
const COL_CLASS: Record<ColKey, string> = {
  tag:        'w-20 flex-shrink-0',
  name:       'w-32 flex-shrink-0',
  species:    'w-14 flex-shrink-0',
  breed:      'w-28 flex-shrink-0',
  sex:        'w-9  flex-shrink-0',
  dob:        'w-24 flex-shrink-0',
  herd:       'w-28 flex-shrink-0',
  paddock:    'w-28 flex-shrink-0',
  chipId:     'w-24 flex-shrink-0',
  nationalId: 'w-28 flex-shrink-0',
  weight:     'w-16 flex-shrink-0',
  purpose:    'w-28 flex-shrink-0',
  status:     'w-36 flex-shrink-0',
}

const COL_STORAGE_KEY = 'farm_table_cols_v1'

type ColConfig = { key: ColKey; visible: boolean }[]

function defaultColConfig(): ColConfig {
  return ALL_COLUMNS.map(c => ({ key: c.key, visible: c.defaultVisible }))
}

function loadColConfig(): ColConfig {
  try {
    const raw = localStorage.getItem(COL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ColConfig
      const validKeys = new Set(ALL_COLUMNS.map(c => c.key))
      const filtered = parsed.filter(c => validKeys.has(c.key))
      const savedKeys = new Set(filtered.map(c => c.key))
      const newCols = ALL_COLUMNS
        .filter(c => !savedKeys.has(c.key))
        .map(c => ({ key: c.key, visible: c.defaultVisible }))
      return [...filtered, ...newCols]
    }
  } catch { /* ignore */ }
  return defaultColConfig()
}

// ── Shared professional components ────────────────────────────────────────────

export function SpeciesBadge({ species }: { species: FarmSpecies }) {
  return (
    <span className="inline-block font-mono text-[10px] font-bold tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded select-none">
      {FARM_SPECIES_CODE[species]}
    </span>
  )
}

const STATUS_STYLE: Record<FarmAnimalStatus, string> = {
  active:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  sold:     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  deceased: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  culled:   'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  lost:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export function StatusBadge({ status }: { status?: FarmAnimalStatus }) {
  const s = status ?? 'active'
  return (
    <span className={`inline-block text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[s]}`}>
      {FARM_STATUS_LABELS[s].split(' ')[0]}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FarmPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [animals, setAnimals] = useState<FarmAnimal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [filterSpecies, setFilterSpecies] = useState<FarmSpecies | 'all'>('all')
  const [filterHerd, setFilterHerd] = useState<string | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)

  // ── Column config ───────────────────────────────────────────────────────────
  const [colConfig, setColConfig] = useState<ColConfig>(loadColConfig)
  const [colSettingsOpen, setColSettingsOpen] = useState(false)

  // ── Horizontal-scroll sync refs ─────────────────────────────────────────────
  // The sticky column header (overflow-x-hidden) mirrors the body scroll position.
  const colHeaderRef = useRef<HTMLDivElement>(null)
  const tableBodyRef  = useRef<HTMLDivElement>(null)

  function syncColHeader(e: React.UIEvent<HTMLDivElement>) {
    if (colHeaderRef.current) {
      colHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  useEffect(() => {
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(colConfig))
  }, [colConfig])

  const visibleCols = colConfig.filter(c => c.visible)

  function toggleCol(key: ColKey) {
    const def = ALL_COLUMNS.find(c => c.key === key)!
    if (def.alwaysVisible) return
    setColConfig(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }

  function moveCol(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= colConfig.length) return
    setColConfig(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function resetCols() {
    setColConfig(defaultColConfig())
  }

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Bulk share modal state ──────────────────────────────────────────────────
  const [bulkShareOpen, setBulkShareOpen] = useState(false)
  const [bulkShareEmail, setBulkShareEmail] = useState('')
  const [bulkSharing, setBulkSharing] = useState(false)

  // ── Bulk edit modal state ───────────────────────────────────────────────────
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState({ herd: '', paddock: '', status: '' as FarmAnimalStatus | '' })
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    getFarmAnimals(user.uid)
      .then(setAnimals)
      .finally(() => setLoading(false))
  }, [user])

  const herds = useMemo(() => {
    const h = new Set<string>()
    animals.forEach(a => { if (a.herd) h.add(a.herd) })
    return Array.from(h).sort()
  }, [animals])

  const presentSpecies = useMemo(() => {
    const s = new Set<FarmSpecies>()
    animals.forEach(a => s.add(a.species))
    return ALL_FARM_SPECIES.filter(sp => s.has(sp))
  }, [animals])

  const filtered = useMemo(() => {
    let list = animals
    if (!showInactive) list = list.filter(a => (a.status ?? 'active') === 'active')
    if (filterSpecies !== 'all') list = list.filter(a => a.species === filterSpecies)
    if (filterHerd !== 'all') list = list.filter(a => (a.herd ?? 'Ungrouped') === filterHerd)
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase()
      list = list.filter(a =>
        a.tagNumber.toLowerCase().includes(q) ||
        a.nationalId?.toLowerCase().includes(q) ||
        a.chipId?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.breed?.toLowerCase().includes(q) ||
        a.herd?.toLowerCase().includes(q) ||
        a.paddock?.toLowerCase().includes(q),
      )
    }
    return list
  }, [animals, filterSpecies, filterHerd, searchQ, showInactive])

  const grouped = useMemo(() => {
    const map = new Map<string, FarmAnimal[]>()
    filtered.forEach(a => {
      const key = a.herd || 'UNGROUPED'
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'UNGROUPED') return 1
      if (b === 'UNGROUPED') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  // ── Selection helpers ───────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedIds(new Set(filtered.map(a => a.id))) }
  function clearSelection() { setSelectedIds(new Set()) }

  function exitSelectionMode() {
    setSelectionMode(false)
    clearSelection()
  }

  // ── Bulk share ──────────────────────────────────────────────────────────────

  async function handleBulkShare() {
    if (!user || !bulkShareEmail.trim()) return
    setBulkSharing(true)
    const selectedAnimals = animals.filter(a => selectedIds.has(a.id))
    let successCount = 0
    const errorMessages: string[] = []
    for (const animal of selectedAnimals) {
      try {
        await sendShareInvite(
          user.uid,
          profile?.Full_Name ?? user.email ?? 'Unknown',
          bulkShareEmail.trim(),
          'farmAnimal',
          animal.id,
          animal.name ?? `#${animal.tagNumber}`,
        )
        successCount++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!msg.includes('already exists') && !msg.includes('already has access')) {
          errorMessages.push(`${animal.name ?? animal.tagNumber}: ${msg}`)
        } else {
          successCount++
        }
      }
    }
    setBulkSharing(false)
    setBulkShareOpen(false)
    setBulkShareEmail('')
    if (errorMessages.length === 0) {
      alert(`Invitation sent to ${bulkShareEmail.trim()} for ${successCount} animal${successCount !== 1 ? 's' : ''}.`)
    } else {
      alert(`Sent ${successCount} invitations. Issues:\n${errorMessages.join('\n')}`)
    }
  }

  // ── Bulk edit ───────────────────────────────────────────────────────────────

  async function handleBulkEdit() {
    if (!user) return
    const updates: Partial<FarmAnimalInput> = {}
    if (bulkEditForm.herd.trim()) updates.herd = bulkEditForm.herd.trim()
    if (bulkEditForm.paddock.trim()) updates.paddock = bulkEditForm.paddock.trim()
    if (bulkEditForm.status) updates.status = bulkEditForm.status as FarmAnimalStatus

    if (Object.keys(updates).length === 0) {
      alert('Enter at least one field to update.')
      return
    }
    setBulkSaving(true)
    try {
      const selectedAnimals = animals.filter(a => selectedIds.has(a.id))
      await Promise.all(selectedAnimals.map(a => updateFarmAnimal(user.uid, a.id, updates)))
      setAnimals(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, ...updates } : a))
      setBulkEditOpen(false)
      setBulkEditForm({ herd: '', paddock: '', status: '' })
      exitSelectionMode()
    } catch (e) {
      console.error(e)
      alert('Error updating. Please try again.')
    } finally {
      setBulkSaving(false)
    }
  }

  // ── CSV export ──────────────────────────────────────────────────────────────

  function downloadCSV() {
    const header = IMPORT_TEMPLATE_HEADERS.join(',')
    const rows = animals.map(a => {
      const row: Partial<FarmImportRow> = {
        tagNumber:      a.tagNumber,
        species:        a.species,
        chipId:         a.chipId ?? '',
        nationalId:     a.nationalId ?? '',
        name:           a.name ?? '',
        breed:          a.breed ?? '',
        sex:            a.sex ?? '',
        colour:         a.colour ?? '',
        dateOfBirth:    a.dateOfBirth ?? '',
        weight:         a.weight != null ? String(a.weight) : '',
        weightUnit:     a.weightUnit ?? 'kg',
        status:         a.status ?? 'active',
        purpose:        a.purpose ?? '',
        herd:           a.herd ?? '',
        paddock:        a.paddock ?? '',
        damId:          a.damId ?? '',
        sireId:         a.sireId ?? '',
        purchaseDate:   a.purchaseDate ?? '',
        purchaseSource: a.purchaseSource ?? '',
        notes:          a.notes ?? '',
      }
      return IMPORT_TEMPLATE_HEADERS.map(h => {
        const v = (row as unknown as Record<string, string>)[h] ?? ''
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `farm_animals_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(animal: FarmAnimal) {
    if (!user) return
    const label = animal.name ?? `#${animal.tagNumber}`
    if (!window.confirm(`Remove ${label} from records? Vaccine history will not be deleted.`)) return
    try {
      await deleteFarmAnimal(user.uid, animal.id)
      setAnimals(prev => prev.filter(a => a.id !== animal.id))
    } catch {
      alert('Error deleting. Please try again.')
    }
  }

  // ── Cell renderer ───────────────────────────────────────────────────────────

  function renderCell(animal: FarmAnimal, key: ColKey): React.ReactNode {
    switch (key) {
      case 'tag':
        return (
          <div className="min-w-0">
            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white truncate leading-tight">
              {animal.tagNumber}
            </p>
            {animal.chipId && (
              <p className="text-[10px] text-gray-300 dark:text-gray-600 font-mono truncate">
                …{animal.chipId.slice(-6)}
              </p>
            )}
          </div>
        )
      case 'name':
        return <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{animal.name ?? '—'}</p>
      case 'species':
        return <SpeciesBadge species={animal.species} />
      case 'breed':
        return <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{animal.breed ?? '—'}</p>
      case 'sex':
        return <p className="text-xs text-gray-600 dark:text-gray-300">{animal.sex ?? '—'}</p>
      case 'dob':
        return <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{animal.dateOfBirth ?? '—'}</p>
      case 'herd':
        return <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{animal.herd ?? '—'}</p>
      case 'paddock':
        return <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{animal.paddock ?? '—'}</p>
      case 'chipId':
        return <p className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{animal.chipId ?? '—'}</p>
      case 'nationalId':
        return <p className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{animal.nationalId ?? '—'}</p>
      case 'weight':
        return (
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {animal.weight != null ? `${animal.weight} ${animal.weightUnit ?? 'kg'}` : '—'}
          </p>
        )
      case 'purpose':
        return <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{animal.purpose ?? '—'}</p>
      case 'status':
        return (
          <div className="flex items-center justify-end gap-1.5">
            <StatusBadge status={animal.status} />
            {!selectionMode && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(animal) }}
                  className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 active:scale-90 transition-transform"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </div>
        )
    }
  }

  const activeCount = animals.filter(a => (a.status ?? 'active') === 'active').length
  const inactiveCount = animals.length - activeCount

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">

      {/* ── Professional header ── */}
      <div className="bg-white dark:bg-gray-800 sticky top-0 z-10">
        <div className="px-4 pt-safe">
          {/* Title row */}
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <button
                  onClick={exitSelectionMode}
                  className="p-1.5 -ml-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => navigate('/')}
                  className="p-1.5 -ml-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Back to home"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight uppercase">
                  {selectionMode ? `${selectedIds.size} Selected` : 'Farm Management'}
                </h1>
                {!selectionMode && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 -mt-0.5">
                    Livestock Vaccination Register
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <button
                  onClick={selectedIds.size === filtered.length ? clearSelection : selectAll}
                  className="text-xs font-semibold text-green-700 dark:text-green-400 px-2 py-1.5"
                >
                  {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
                </button>
              ) : (
                <>
                  {animals.length > 0 && (
                    <button
                      onClick={() => setSelectionMode(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 active:bg-gray-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span className="hidden sm:inline">Select</span>
                    </button>
                  )}
                  {animals.length > 0 && (
                    <button
                      onClick={downloadCSV}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 active:bg-gray-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8" />
                      </svg>
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  )}
                  {/* Vaccination report PDF */}
                  <button
                    onClick={() => navigate('/report')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 active:bg-gray-50"
                    title="Download vaccination report"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="hidden sm:inline">Report</span>
                  </button>
                  <button
                    onClick={() => navigate('/farm/import')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 active:bg-gray-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => navigate('/farm/add')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-700 text-white text-xs font-semibold active:bg-green-800"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Add Animal</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="pb-2.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search tag, chip, name, herd, paddock…"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Filter bar */}
          <div className="pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            <select
              value={filterHerd}
              onChange={e => setFilterHerd(e.target.value)}
              className="flex-shrink-0 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              <option value="all">All Herds</option>
              {herds.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select
              value={filterSpecies}
              onChange={e => setFilterSpecies(e.target.value as FarmSpecies | 'all')}
              className="flex-shrink-0 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              <option value="all">All Species</option>
              {presentSpecies.map(sp => (
                <option key={sp} value={sp}>{FARM_SPECIES_LABELS[sp]}</option>
              ))}
            </select>
            <button
              onClick={() => setShowInactive(v => !v)}
              className={`flex-shrink-0 text-xs border rounded-lg px-2 py-1.5 font-medium transition-colors ${
                showInactive
                  ? 'border-gray-700 dark:border-gray-300 bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {showInactive ? 'Active + Inactive' : 'Active only'}
            </button>
          </div>
        </div>

        {/* ── Sticky column header (horizontally mirrors the table body scroll) ── */}
        {!loading && animals.length > 0 && (
          <div
            ref={colHeaderRef}
            className="overflow-x-hidden border-t border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50"
          >
            <div className="min-w-max px-4 py-1.5 flex items-center gap-2">
              {selectionMode && <div className="w-5 flex-shrink-0" />}
              {visibleCols.map(col => {
                const def = ALL_COLUMNS.find(c => c.key === col.key)!
                return (
                  <div key={col.key} className={COL_CLASS[col.key]}>
                    <span className={`block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest truncate ${col.key === 'status' ? 'text-right' : ''}`}>
                      {def.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 uppercase tracking-widest">Loading records…</p>
        </div>
      ) : animals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-sm">No Records</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-6 text-center">
            Add animals individually or import a CSV / Excel file
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/farm/import')}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Import CSV / Excel
            </button>
            <button
              onClick={() => navigate('/farm/add')}
              className="px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold"
            >
              Add Animal
            </button>
          </div>
        </div>
      ) : (
        <>
        {/* Stats bar — full-width, scrolls with page */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{activeCount}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Active</span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{herds.length || '—'}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Herds</span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{presentSpecies.length}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Species</span>
          </div>
          {inactiveCount > 0 && (
            <>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-gray-500 dark:text-gray-400">{inactiveCount}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Inactive</span>
              </div>
            </>
          )}
          {/* Spacer + right side: count + column settings cog */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <span className="text-xs text-gray-400">{filtered.length} shown</span>
            <button
              onClick={() => setColSettingsOpen(true)}
              title="Configure columns"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Horizontally-scrollable table body — syncs with sticky column header */}
        <div
          ref={tableBodyRef}
          className={`overflow-x-auto ${selectionMode ? 'pb-32' : 'pb-16'}`}
          onScroll={syncColHeader}
        >
          <div className="min-w-max">
            {grouped.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-10 px-4">No animals match the current filters</p>
            ) : (
              grouped.map(([herd, herdAnimals]) => (
                <div key={herd}>
                  {/* Herd section header */}
                  <div className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center gap-2 mt-1 first:mt-0">
                    {selectionMode && (
                      <button
                        onClick={() => {
                          const ids = herdAnimals.map(a => a.id)
                          const allSelected = ids.every(id => selectedIds.has(id))
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (allSelected) ids.forEach(id => next.delete(id))
                            else ids.forEach(id => next.add(id))
                            return next
                          })
                        }}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          herdAnimals.every(a => selectedIds.has(a.id))
                            ? 'border-green-600 bg-green-600'
                            : herdAnimals.some(a => selectedIds.has(a.id))
                              ? 'border-green-400 bg-green-100 dark:bg-green-900/30'
                              : 'border-gray-300 dark:border-gray-500'
                        }`}
                      >
                        {herdAnimals.every(a => selectedIds.has(a.id)) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">{herd}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({herdAnimals.length})</span>
                  </div>

                  {/* Animal rows */}
                  <div className="bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-700/50">
                    {herdAnimals.map(animal => (
                      <div
                        key={animal.id}
                        className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
                          selectionMode && selectedIds.has(animal.id)
                            ? 'bg-green-50 dark:bg-green-900/10'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 active:bg-gray-100 dark:active:bg-gray-700/50'
                        }`}
                        onClick={() => selectionMode ? toggleSelect(animal.id) : navigate(`/farm/${animal.id}`)}
                      >
                        {/* Checkbox (selection mode) */}
                        {selectionMode && (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              selectedIds.has(animal.id)
                                ? 'border-green-600 bg-green-600'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}
                          >
                            {selectedIds.has(animal.id) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        )}

                        {/* Dynamic columns */}
                        <div className="flex items-center gap-2">
                          {visibleCols.map(col => (
                            <div key={col.key} className={COL_CLASS[col.key]}>
                              {renderCell(animal, col.key)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      {/* ── Selection mode action bar ─────────────────────────────────────────── */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 pb-safe">
          {selectedIds.size === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 dark:text-gray-500">Tap rows to select animals</p>
              <button
                onClick={exitSelectionMode}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={exitSelectionMode}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700 flex-shrink-0"
              >
                Cancel
              </button>
              <p className="text-sm font-bold text-gray-900 dark:text-white flex-1 truncate">
                {selectedIds.size} animal{selectedIds.size !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => setBulkShareOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={() => setBulkEditOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold active:bg-green-800"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Column settings sheet ─────────────────────────────────────────────── */}
      {colSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setColSettingsOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl flex flex-col max-h-[80vh]">
            {/* Handle + header */}
            <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Table Columns</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Toggle visibility and drag to reorder</p>
                </div>
                <button
                  onClick={resetCols}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Reset defaults
                </button>
              </div>
            </div>

            {/* Column list */}
            <div className="overflow-y-auto flex-1 px-6 py-2 pb-safe">
              {colConfig.map((col, i) => {
                const def = ALL_COLUMNS.find(c => c.key === col.key)!
                return (
                  <div key={col.key} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    {/* Up / Down reorder */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveCol(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-0 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveCol(i, 1)}
                        disabled={i === colConfig.length - 1}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-0 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Column name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{def.label}</p>
                      {def.alwaysVisible && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Always visible</p>
                      )}
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleCol(col.key)}
                      disabled={def.alwaysVisible}
                      className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${
                        col.visible ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                      } disabled:opacity-40`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${col.visible ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Done button */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setColSettingsOpen(false)}
                className="w-full py-3 rounded-2xl bg-green-700 text-white text-sm font-semibold active:bg-green-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Share Modal ──────────────────────────────────────────────────── */}
      {bulkShareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setBulkShareOpen(false); setBulkShareEmail('') }} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl px-6 py-6 pb-safe">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Share {selectedIds.size} Animal{selectedIds.size !== 1 ? 's' : ''}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Invite another user by email to access and manage the selected animal records.
            </p>
            <input
              type="email"
              value={bulkShareEmail}
              onChange={e => setBulkShareEmail(e.target.value)}
              placeholder="Email address"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-green-600 dark:placeholder-gray-400 mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setBulkShareOpen(false); setBulkShareEmail('') }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkShare}
                disabled={!bulkShareEmail.trim() || bulkSharing}
                className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-semibold disabled:opacity-50 active:bg-green-800"
              >
                {bulkSharing ? 'Sending…' : 'Send Invites'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Modal ───────────────────────────────────────────────────── */}
      {bulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBulkEditOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl px-6 py-6 pb-safe">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Edit {selectedIds.size} Animal{selectedIds.size !== 1 ? 's' : ''}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Fill in only the fields you want to change. Blank fields keep their existing value.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Herd</label>
                <input
                  type="text"
                  value={bulkEditForm.herd}
                  onChange={e => setBulkEditForm(f => ({ ...f, herd: e.target.value }))}
                  placeholder="Leave blank to keep existing"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Paddock</label>
                <input
                  type="text"
                  value={bulkEditForm.paddock}
                  onChange={e => setBulkEditForm(f => ({ ...f, paddock: e.target.value }))}
                  placeholder="Leave blank to keep existing"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={bulkEditForm.status}
                  onChange={e => setBulkEditForm(f => ({ ...f, status: e.target.value as FarmAnimalStatus | '' }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">Keep existing status</option>
                  {(Object.entries(FARM_STATUS_LABELS) as [FarmAnimalStatus, string][]).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEdit}
                disabled={bulkSaving}
                className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-semibold disabled:opacity-50 active:bg-green-800"
              >
                {bulkSaving ? 'Saving…' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
