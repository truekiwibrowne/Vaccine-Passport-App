import { useState, useEffect } from 'react'
import { getSTILibrary, addSTIEntry, updateSTIEntry, deleteSTIEntry } from '../services/stiLibraryService'
import type { STILibraryEntry } from '../types/stiLibrary'
import { SH_CONDITION_LABELS, SH_CURABILITY_LABELS, SH_CURABILITY_COLOURS } from '../types/sexualHealth'
import type { SHCurability } from '../types/sexualHealth'
import { useIsLg } from '../hooks/useMediaQuery'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'

type CurabilityKey = 'curable' | 'clearable' | 'lifelong'

const CONDITION_OPTIONS = Object.entries(SH_CONDITION_LABELS).map(([key, label]) => ({ key, label }))

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1'

type FormState = Omit<STILibraryEntry, 'id' | 'Created' | 'Updated'>

const EMPTY_FORM: FormState = {
  condition: 'hiv',
  name: '',
  curability: 'lifelong',
  shortDescription: '',
  symptoms: [],
  transmission: [],
  treatment: '',
  preventionTips: [],
  whenToTest: '',
  resources: [],
}

function arrayToText(arr: string[]): string {
  return arr.join('\n')
}

function textToArray(text: string): string[] {
  return text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
}

interface ResourceItem { label: string; url: string }

function ResourceEditor({
  resources,
  onChange,
}: {
  resources: ResourceItem[]
  onChange: (r: ResourceItem[]) => void
}) {
  function update(i: number, field: keyof ResourceItem, val: string) {
    const next = resources.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    onChange(next)
  }
  function add() { onChange([...resources, { label: '', url: '' }]) }
  function remove(i: number) { onChange(resources.filter((_, idx) => idx !== i)) }

  return (
    <div className="flex flex-col gap-2">
      {resources.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Label"
            value={r.label}
            onChange={e => update(i, 'label', e.target.value)}
          />
          <input
            className={`${inputCls} flex-1`}
            placeholder="https://..."
            value={r.url}
            onChange={e => update(i, 'url', e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-red-400 hover:text-red-600 transition-colors px-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline self-start"
      >
        + Add resource
      </button>
    </div>
  )
}

function EntryForm({
  initial,
  onSave,
  onDelete,
  saving,
}: {
  initial: FormState & { id?: string }
  onSave: (data: FormState, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>({
    condition: initial.condition,
    name: initial.name,
    curability: initial.curability,
    shortDescription: initial.shortDescription,
    symptoms: initial.symptoms,
    transmission: initial.transmission,
    treatment: initial.treatment,
    preventionTips: initial.preventionTips,
    whenToTest: initial.whenToTest,
    resources: initial.resources,
  })
  const [symptomsText, setSymptomsText]       = useState(arrayToText(initial.symptoms))
  const [transmissionText, setTransmissionText] = useState(arrayToText(initial.transmission))
  const [preventionText, setPreventionText]   = useState(arrayToText(initial.preventionTips))
  const [deleting, setDeleting] = useState(false)

  // Sync when initial changes (switching selected entry)
  useEffect(() => {
    setForm({
      condition: initial.condition,
      name: initial.name,
      curability: initial.curability,
      shortDescription: initial.shortDescription,
      symptoms: initial.symptoms,
      transmission: initial.transmission,
      treatment: initial.treatment,
      preventionTips: initial.preventionTips,
      whenToTest: initial.whenToTest,
      resources: initial.resources,
    })
    setSymptomsText(arrayToText(initial.symptoms))
    setTransmissionText(arrayToText(initial.transmission))
    setPreventionText(arrayToText(initial.preventionTips))
  }, [initial.id ?? '']) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: FormState = {
      ...form,
      symptoms:       textToArray(symptomsText),
      transmission:   textToArray(transmissionText),
      preventionTips: textToArray(preventionText),
    }
    await onSave(data, initial.id)
  }

  async function handleDelete() {
    if (!initial.id || !onDelete) return
    if (!window.confirm('Delete this STI Library entry?')) return
    setDeleting(true)
    try { await onDelete(initial.id) } finally { setDeleting(false) }
  }

  const curabilityOptions: CurabilityKey[] = ['curable', 'clearable', 'lifelong']

  return (
    <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {initial.id ? 'Edit Entry' : 'New Entry'}
      </h2>

      {/* Condition */}
      <div>
        <label className={labelCls}>Condition *</label>
        <select
          className={inputCls}
          value={form.condition}
          onChange={e => set('condition', e.target.value)}
          required
        >
          {CONDITION_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {form.condition === 'custom' && (
          <input
            className={`${inputCls} mt-2`}
            placeholder="Custom condition key"
            onChange={e => set('condition', e.target.value)}
          />
        )}
      </div>

      {/* Display Name */}
      <div>
        <label className={labelCls}>Display Name *</label>
        <input
          className={inputCls}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. HIV (Human Immunodeficiency Virus)"
          required
        />
      </div>

      {/* Curability */}
      <div>
        <label className={labelCls}>Curability *</label>
        <select
          className={inputCls}
          value={form.curability}
          onChange={e => set('curability', e.target.value as CurabilityKey)}
          required
        >
          {curabilityOptions.map(c => (
            <option key={c} value={c}>{SH_CURABILITY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Short Description */}
      <div>
        <label className={labelCls}>Short Description *</label>
        <textarea
          className={inputCls}
          rows={3}
          value={form.shortDescription}
          onChange={e => set('shortDescription', e.target.value)}
          placeholder="1-2 sentence summary"
          required
        />
      </div>

      {/* Symptoms */}
      <div>
        <label className={labelCls}>Symptoms (one per line or comma-separated)</label>
        <textarea
          className={inputCls}
          rows={3}
          value={symptomsText}
          onChange={e => setSymptomsText(e.target.value)}
          placeholder="e.g. Fever&#10;Rash&#10;Fatigue"
        />
      </div>

      {/* Transmission */}
      <div>
        <label className={labelCls}>Transmission (one per line or comma-separated)</label>
        <textarea
          className={inputCls}
          rows={3}
          value={transmissionText}
          onChange={e => setTransmissionText(e.target.value)}
          placeholder="e.g. Sexual contact&#10;Blood-to-blood contact"
        />
      </div>

      {/* Treatment */}
      <div>
        <label className={labelCls}>Treatment</label>
        <textarea
          className={inputCls}
          rows={3}
          value={form.treatment}
          onChange={e => set('treatment', e.target.value)}
          placeholder="How it is treated"
        />
      </div>

      {/* Prevention Tips */}
      <div>
        <label className={labelCls}>Prevention Tips (one per line or comma-separated)</label>
        <textarea
          className={inputCls}
          rows={3}
          value={preventionText}
          onChange={e => setPreventionText(e.target.value)}
          placeholder="e.g. Use condoms consistently&#10;Get vaccinated (HPV, Hep B)"
        />
      </div>

      {/* When to Test */}
      <div>
        <label className={labelCls}>When to Test</label>
        <textarea
          className={inputCls}
          rows={2}
          value={form.whenToTest}
          onChange={e => set('whenToTest', e.target.value)}
          placeholder="Testing frequency guidance"
        />
      </div>

      {/* Resources */}
      <div>
        <label className={labelCls}>Resources</label>
        <ResourceEditor
          resources={form.resources}
          onChange={v => set('resources', v)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : initial.id ? 'Update' : 'Save'}
        </button>
        {initial.id && onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-sm font-semibold disabled:opacity-60 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AdminSTILibraryPage() {
  const isLg = useIsLg()
  const [entries, setEntries]           = useState<STILibraryEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<STILibraryEntry | null>(null)
  const [addMode, setAddMode]           = useState(false)
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    setLoading(true)
    getSTILibrary()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(data: FormState, id?: string) {
    setSaving(true)
    try {
      if (id) {
        await updateSTIEntry(id, data)
        setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
        setSelected(prev => prev ? { ...prev, ...data } : prev)
      } else {
        const newId = await addSTIEntry(data)
        const newEntry: STILibraryEntry = { ...data, id: newId, Created: new Date().toISOString(), Updated: new Date().toISOString() }
        setEntries(prev => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)))
        setSelected(newEntry)
        setAddMode(false)
      }
    } catch (e) {
      console.error(e)
      alert('Save failed. Check your permissions.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteSTIEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(null)
    setAddMode(false)
  }

  const curabilityColour = (c: SHCurability) => {
    const colours = SH_CURABILITY_COLOURS[c]
    return `${colours.bg} ${colours.text}`
  }

  const leftPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">STI Entries ({entries.length})</p>
        <button
          onClick={() => { setSelected(null); setAddMode(true) }}
          className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No entries yet. Click + to add one.
          </div>
        ) : (
          <div>
            {entries.map((e, i) => {
              const isSelected = selected?.id === e.id
              return (
                <div key={e.id}>
                  {i > 0 && <div className="h-px bg-gray-100 dark:border-gray-700 mx-4" />}
                  <button
                    onClick={() => { setSelected(e); setAddMode(false) }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{e.name || e.condition}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${curabilityColour(e.curability as SHCurability)}`}>
                      {SH_CURABILITY_LABELS[e.curability as SHCurability]}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const rightPanel = addMode ? (
    <EntryForm
      initial={{ ...EMPTY_FORM }}
      onSave={handleSave}
      saving={saving}
    />
  ) : selected ? (
    <EntryForm
      key={selected.id}
      initial={{ ...selected }}
      onSave={handleSave}
      onDelete={handleDelete}
      saving={saving}
    />
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <p className="text-base font-semibold text-gray-400 dark:text-gray-500">Select an entry to edit</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">or click + to add a new condition</p>
    </div>
  )

  if (isLg) {
    return (
      <ResizableSplitPane
        storageKey="splitPane:adminSTI"
        leftClassName="overflow-y-auto bg-white dark:bg-gray-800/50"
        rightClassName="bg-gray-50 dark:bg-gray-900 overflow-y-auto"
        left={leftPanel}
        right={rightPanel}
      />
    )
  }

  // Mobile: show list or form
  if (selected || addMode) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-full">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setAddMode(false) }}
            className="p-1 -ml-1"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {addMode ? 'New STI Entry' : 'Edit Entry'}
          </p>
        </div>
        <div className="overflow-y-auto pb-20">{rightPanel}</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 min-h-full">
      {leftPanel}
    </div>
  )
}
