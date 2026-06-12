import { useState, useEffect } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { getAllAnimalVaccines, addAnimalVaccine, updateAnimalVaccine, deleteAnimalVaccine } from '../services/animalVaccineLibraryService'
import { getDiseaseRisk, setDiseaseRisk, deleteDiseaseRisk } from '../services/diseaseRiskService'
import { GeoTagInput } from '../components/ui/GeoTagInput'
import type { AnimalVaccineEntry } from '../types/animalVaccine'
import type { PetSpecies } from '../types/pet'
import { PET_SPECIES_LABELS, PET_SPECIES_EMOJI } from '../types/pet'

const ALL_SPECIES: PetSpecies[] = ['dog', 'cat', 'bird', 'rabbit', 'horse', 'guinea_pig', 'reptile', 'fish', 'other']

const STATUS_OPTS: { value: AnimalVaccineEntry['status']; label: string; colour: string }[] = [
  { value: 'available', label: 'Available', colour: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'trial', label: 'Trial', colour: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'premarket', label: 'Pre-market', colour: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
]

function statusColour(status?: AnimalVaccineEntry['status']) {
  return STATUS_OPTS.find(s => s.value === status)?.colour ?? STATUS_OPTS[0].colour
}

const emptyForm = {
  Vac_Name: '',
  Disease_Target: '',
  Manufacturer: '',
  Species: [] as string[],
  allSpecies: false,
  Type: '',
  Dosing_Schedule: '',
  Notes: '',
  status: 'available' as AnimalVaccineEntry['status'],
}

export function AdminAnimalLibraryPage() {
  const [entries, setEntries] = useState<AnimalVaccineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AnimalVaccineEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  // Risk map editor
  const [riskHigh,     setRiskHigh]     = useState('')
  const [riskMedium,   setRiskMedium]   = useState('')
  const [riskNote,     setRiskNote]     = useState('')
  const [riskSaving,   setRiskSaving]   = useState(false)
  const [riskSavedMsg, setRiskSavedMsg] = useState('')
  const [showRisk,     setShowRisk]     = useState(false)

  useEffect(() => {
    getAllAnimalVaccines()
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter(e => {
    if (!searchQ.trim()) return true
    const q = searchQ.toLowerCase()
    return (
      e.Vac_Name?.toLowerCase().includes(q) ||
      e.Disease_Target?.toLowerCase().includes(q) ||
      e.Manufacturer?.toLowerCase().includes(q)
    )
  })

  function resetRisk() {
    setRiskHigh(''); setRiskMedium(''); setRiskNote('')
    setRiskSavedMsg(''); setShowRisk(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    resetRisk()
    setModalOpen(true)
  }

  function openEdit(entry: AnimalVaccineEntry) {
    setEditing(entry)
    const isAll = entry.Species?.includes('all') ?? false
    setForm({
      Vac_Name: entry.Vac_Name,
      Disease_Target: entry.Disease_Target,
      Manufacturer: entry.Manufacturer ?? '',
      Species: isAll ? [] : (entry.Species ?? []),
      allSpecies: isAll,
      Type: entry.Type ?? '',
      Dosing_Schedule: entry.Dosing_Schedule ?? '',
      Notes: entry.Notes ?? '',
      status: entry.status ?? 'available',
    })
    resetRisk()
    // Load existing risk data
    getDiseaseRisk(entry.id)
      .then(doc => {
        if (doc) {
          setRiskHigh(doc.high.join(', '))
          setRiskMedium(doc.medium.join(', '))
          setRiskNote(doc.note ?? '')
          setShowRisk(true)
        }
      })
      .catch(() => {})
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    resetRisk()
  }

  async function saveRiskMap() {
    if (!editing) return
    setRiskSaving(true); setRiskSavedMsg('')
    try {
      const parseTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean)
      await setDiseaseRisk(editing.id, {
        diseaseTarget: form.Disease_Target,
        high:   parseTags(riskHigh),
        medium: parseTags(riskMedium),
        note:   riskNote.trim(),
      })
      setRiskSavedMsg('Saved!')
      setTimeout(() => setRiskSavedMsg(''), 3000)
    } catch { alert('Error saving risk data.') }
    finally { setRiskSaving(false) }
  }

  async function clearRiskMap() {
    if (!editing) return
    if (!window.confirm('Remove all risk map data for this entry?')) return
    await deleteDiseaseRisk(editing.id).catch(() => {})
    resetRisk()
  }

  function toggleSpecies(sp: string) {
    setForm(f => ({
      ...f,
      Species: f.Species.includes(sp)
        ? f.Species.filter(s => s !== sp)
        : [...f.Species, sp],
    }))
  }

  async function handleSave() {
    if (!form.Vac_Name.trim() || !form.Disease_Target.trim()) return
    setSaving(true)
    try {
      const speciesArr = form.allSpecies ? ['all'] : form.Species
      const data: Omit<AnimalVaccineEntry, 'id'> = {
        Vac_Name: form.Vac_Name.trim(),
        Disease_Target: form.Disease_Target.trim(),
        Species: speciesArr,
        status: form.status,
        ...(form.Manufacturer.trim() ? { Manufacturer: form.Manufacturer.trim() } : {}),
        ...(form.Type.trim() ? { Type: form.Type.trim() } : {}),
        ...(form.Dosing_Schedule.trim() ? { Dosing_Schedule: form.Dosing_Schedule.trim() } : {}),
        ...(form.Notes.trim() ? { Notes: form.Notes.trim() } : {}),
      }
      if (editing) {
        await updateAnimalVaccine(editing.id, data)
        setEntries(prev => prev.map(e => e.id === editing.id ? { id: editing.id, ...data } : e))
      } else {
        const id = await addAnimalVaccine(data)
        setEntries(prev => [{ id, ...data }, ...prev])
      }
      closeModal()
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete "${editing.Vac_Name}"? This cannot be undone.`)) return
    try {
      await deleteAnimalVaccine(editing.id)
      setEntries(prev => prev.filter(e => e.id !== editing.id))
      closeModal()
    } catch (e) {
      console.error(e)
      alert('Error deleting. Please try again.')
    }
  }

  return (
    <div className="px-4 py-4 pb-32">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search animal vaccines…"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <button
          onClick={openNew}
          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-2.5 rounded-xl active:opacity-80 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Entry
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'} · tap to edit
          </p>
          <div className="flex flex-col gap-3">
            {filtered.map(entry => (
              <button
                key={entry.id}
                onClick={() => openEdit(entry)}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm text-left w-full active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{entry.Vac_Name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry.Disease_Target}</p>
                    {entry.Manufacturer && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{entry.Manufacturer}</p>
                    )}
                  </div>
                  {entry.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColour(entry.status)}`}>
                      {STATUS_OPTS.find(s => s.value === entry.status)?.label}
                    </span>
                  )}
                </div>
                {entry.Species && entry.Species.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.Species.includes('all') ? (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">All species</span>
                    ) : (
                      entry.Species.map(sp => (
                        <span key={sp} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          {PET_SPECIES_EMOJI[sp as PetSpecies] ?? ''} {PET_SPECIES_LABELS[sp as PetSpecies] ?? sp}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                {searchQ ? `No results for "${searchQ}"` : 'No entries yet — add the first one'}
              </p>
            )}
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Entry' : 'New Animal Vaccine'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Vaccine Name *</label>
            <input
              type="text"
              value={form.Vac_Name}
              onChange={e => setForm(f => ({ ...f, Vac_Name: e.target.value }))}
              placeholder="e.g. Rabies Vaccine"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Disease Target *</label>
            <input
              type="text"
              value={form.Disease_Target}
              onChange={e => setForm(f => ({ ...f, Disease_Target: e.target.value }))}
              placeholder="e.g. Rabies"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Manufacturer (optional)</label>
            <input
              type="text"
              value={form.Manufacturer}
              onChange={e => setForm(f => ({ ...f, Manufacturer: e.target.value }))}
              placeholder="e.g. Merial"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Species</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, allSpecies: !f.allSpecies, Species: [] }))}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  form.allSpecies
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                All species
              </button>
            </div>
            {!form.allSpecies && (
              <div className="grid grid-cols-2 gap-2">
                {ALL_SPECIES.map(sp => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => toggleSpecies(sp)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                      form.Species.includes(sp)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{PET_SPECIES_EMOJI[sp]}</span>
                    <span className="text-xs">{PET_SPECIES_LABELS[sp]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Type / Technology (optional)</label>
            <input
              type="text"
              value={form.Type}
              onChange={e => setForm(f => ({ ...f, Type: e.target.value }))}
              placeholder="e.g. Live attenuated"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Dosing Schedule (optional)</label>
            <input
              type="text"
              value={form.Dosing_Schedule}
              onChange={e => setForm(f => ({ ...f, Dosing_Schedule: e.target.value }))}
              placeholder="e.g. Annual booster"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes (optional)</label>
            <textarea
              value={form.Notes}
              onChange={e => setForm(f => ({ ...f, Notes: e.target.value }))}
              placeholder="Any additional notes…"
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ── Risk Map ── only shown when editing an existing entry */}
          {editing && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRisk(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Map Data</span>
                  {(riskHigh || riskMedium) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Saved</span>
                  )}
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showRisk ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showRisk && (
                <div className="px-4 py-4 flex flex-col gap-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Set which countries appear as high or moderate risk on the map shown in the vaccine detail page.
                  </p>
                  <GeoTagInput
                    label="🔴 High Risk Countries"
                    value={riskHigh}
                    onChange={setRiskHigh}
                    placeholder="Add country where vaccination is required / endemic…"
                  />
                  <GeoTagInput
                    label="🟡 Moderate Risk Countries"
                    value={riskMedium}
                    onChange={setRiskMedium}
                    placeholder="Add country where vaccination is recommended…"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Contextual Note</label>
                    <textarea
                      value={riskNote}
                      onChange={e => setRiskNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note shown below the map…"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveRiskMap}
                      disabled={riskSaving}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {riskSaving ? 'Saving…' : 'Save Risk Map'}
                    </button>
                    <button
                      type="button"
                      onClick={clearRiskMap}
                      className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >Clear</button>
                  </div>
                  {riskSavedMsg && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">{riskSavedMsg}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    form.status === s.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={closeModal}>Cancel</Button>
              <Button
                fullWidth
                loading={saving}
                disabled={!form.Vac_Name.trim() || !form.Disease_Target.trim()}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
            {editing && (
              <Button variant="danger" fullWidth onClick={handleDelete}>
                Delete Entry
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
