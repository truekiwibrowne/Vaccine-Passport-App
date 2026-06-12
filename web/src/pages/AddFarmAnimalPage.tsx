import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { addFarmAnimal, getFarmAnimals } from '../services/farmService'
import type { FarmSpecies, FarmSex, FarmAnimalStatus, FarmPurpose } from '../types/farm'
import {
  FARM_SPECIES_LABELS, FARM_SPECIES_CODE, ALL_FARM_SPECIES,
  FARM_SEX_LABELS, FARM_STATUS_LABELS, FARM_PURPOSE_LABELS,
  ALL_FARM_STATUSES, ALL_FARM_PURPOSES,
} from '../types/farm'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ALL_SEXES: FarmSex[] = ['male', 'female', 'castrated', 'unknown']

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 mt-1 border-b border-gray-100 dark:border-gray-700 pb-1">
      {title}
    </p>
  )
}

export function AddFarmAnimalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [herdSuggestions, setHerdSuggestions] = useState<string[]>([])
  const [paddockSuggestions, setPaddockSuggestions] = useState<string[]>([])

  const [form, setForm] = useState({
    // Identification
    species: '' as FarmSpecies | '',
    tagNumber: '',
    chipId: '',
    nationalId: '',
    name: '',
    // Physical
    breed: '',
    sex: 'unknown' as FarmSex,
    colour: '',
    dateOfBirth: '',
    weight: '',
    weightUnit: 'kg' as 'kg' | 'lb',
    // Management
    status: 'active' as FarmAnimalStatus,
    purpose: '' as FarmPurpose | '',
    herd: '',
    paddock: '',
    // Provenance / breeding
    damId: '',
    sireId: '',
    purchaseDate: '',
    purchaseSource: '',
    notes: '',
  })

  useEffect(() => {
    if (!user) return
    getFarmAnimals(user.uid).then(animals => {
      const h = new Set<string>(), p = new Set<string>()
      animals.forEach(a => {
        if (a.herd) h.add(a.herd)
        if (a.paddock) p.add(a.paddock)
      })
      setHerdSuggestions(Array.from(h).sort())
      setPaddockSuggestions(Array.from(p).sort())
    })
  }, [user])

  function update(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSave() {
    if (!user || !form.species || !form.tagNumber.trim()) return
    setSaving(true)
    try {
      const clean = (s: string) => s.trim() || undefined
      const data = {
        species:         form.species as FarmSpecies,
        tagNumber:       form.tagNumber.trim(),
        chipId:          clean(form.chipId),
        nationalId:      clean(form.nationalId),
        name:            clean(form.name),
        breed:           clean(form.breed),
        sex:             form.sex as FarmSex,
        colour:          clean(form.colour),
        dateOfBirth:     form.dateOfBirth || undefined,
        weight:          form.weight ? parseFloat(form.weight) : undefined,
        weightUnit:      form.weight ? form.weightUnit : undefined,
        status:          form.status as FarmAnimalStatus,
        purpose:         (form.purpose || undefined) as FarmPurpose | undefined,
        herd:            clean(form.herd),
        paddock:         clean(form.paddock),
        damId:           clean(form.damId),
        sireId:          clean(form.sireId),
        purchaseDate:    form.purchaseDate || undefined,
        purchaseSource:  clean(form.purchaseSource),
        notes:           clean(form.notes),
      }
      // Strip undefined keys so Firestore doesn't reject them
      const payload = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as typeof data
      await addFarmAnimal(user.uid, payload)
      navigate(-1)
    } catch (e: unknown) {
      alert(`Error saving: ${(e as Error)?.message ?? 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const canSave = !!form.species && form.tagNumber.trim().length > 0

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 pt-safe py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">Add Animal Record</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">New livestock registration</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

        {/* ── Species ── */}
        <div>
          <SectionHeader title="Species *" />
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_FARM_SPECIES.map(sp => (
              <button
                key={sp}
                type="button"
                onClick={() => update('species', sp)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  form.species === sp
                    ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="font-mono text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded w-8 text-center flex-shrink-0">
                  {FARM_SPECIES_CODE[sp]}
                </span>
                <span className="text-sm">{FARM_SPECIES_LABELS[sp]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Identification ── */}
        <div>
          <SectionHeader title="Identification" />
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1 uppercase tracking-wide">
                Tag / Ear Tag Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.tagNumber}
                onChange={e => update('tagNumber', e.target.value)}
                placeholder="e.g. UK123456 or A0042"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <p className="text-[10px] text-gray-400 mt-1">Primary identifier — ear tag, tattoo, NAIT, etc.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1 uppercase tracking-wide">
                RFID / Microchip ID
              </label>
              <input
                type="text"
                value={form.chipId}
                onChange={e => update('chipId', e.target.value)}
                placeholder="ISO 11784/11785 — 15 digits"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <p className="text-[10px] text-gray-400 mt-1">NFC chip scanning support planned for future update</p>
            </div>
            <Input
              label="National Traceability ID"
              value={form.nationalId}
              onChange={e => update('nationalId', e.target.value)}
              placeholder="NAIT (NZ), NLIS (AU), UK passport, etc."
            />
            <Input
              label="Name (optional)"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Leave blank if not individually named"
            />
          </div>
        </div>

        {/* ── Management ── */}
        <div>
          <SectionHeader title="Management" />
          <div className="flex flex-col gap-3">
            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2 uppercase tracking-wide">Status</label>
              <div className="flex flex-wrap gap-2">
                {ALL_FARM_STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => update('status', s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      form.status === s
                        ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {FARM_STATUS_LABELS[s].split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2 uppercase tracking-wide">Production Purpose</label>
              <div className="flex flex-wrap gap-2">
                {ALL_FARM_PURPOSES.map(p => (
                  <button key={p} type="button" onClick={() => update('purpose', form.purpose === p ? '' : p)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      form.purpose === p
                        ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {FARM_PURPOSE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Herd */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1 uppercase tracking-wide">Herd / Flock / Batch</label>
              <input
                type="text"
                value={form.herd}
                onChange={e => update('herd', e.target.value)}
                list="herd-list"
                placeholder="e.g. Herd A, Flock 3, Batch 24"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              {herdSuggestions.length > 0 && (
                <datalist id="herd-list">{herdSuggestions.map(h => <option key={h} value={h} />)}</datalist>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Animals in the same group are listed together in the register</p>
            </div>

            {/* Paddock */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1 uppercase tracking-wide">Paddock / Location</label>
              <input
                type="text"
                value={form.paddock}
                onChange={e => update('paddock', e.target.value)}
                list="paddock-list"
                placeholder="e.g. North Paddock, Pen 12"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              {paddockSuggestions.length > 0 && (
                <datalist id="paddock-list">{paddockSuggestions.map(p => <option key={p} value={p} />)}</datalist>
              )}
            </div>
          </div>
        </div>

        {/* ── Physical Description ── */}
        <div>
          <SectionHeader title="Physical Description" />
          <div className="flex flex-col gap-3">
            <Input label="Breed" value={form.breed} onChange={e => update('breed', e.target.value)} placeholder="e.g. Hereford, Merino" />
            <Input label="Colour / Markings" value={form.colour} onChange={e => update('colour', e.target.value)} placeholder="e.g. Red & White, Piebald" />

            {/* Sex */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2 uppercase tracking-wide">Sex</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SEXES.map(s => (
                  <button key={s} type="button" onClick={() => update('sex', s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      form.sex === s
                        ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {FARM_SEX_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />

            {/* Weight */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1 uppercase tracking-wide">Weight</label>
              <div className="flex gap-2">
                <input
                  type="number" min="0" step="0.1"
                  value={form.weight}
                  onChange={e => update('weight', e.target.value)}
                  placeholder="0.0"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  {(['kg', 'lb'] as const).map(unit => (
                    <button key={unit} type="button" onClick={() => update('weightUnit', unit)}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${
                        form.weightUnit === unit
                          ? 'bg-green-700 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Provenance & Breeding ── */}
        <div>
          <SectionHeader title="Provenance & Breeding" />
          <div className="flex flex-col gap-3">
            <Input
              label="Dam Tag (Mother's ID)"
              value={form.damId}
              onChange={e => update('damId', e.target.value)}
              placeholder="Mother's ear tag number"
            />
            <Input
              label="Sire Tag (Father's ID)"
              value={form.sireId}
              onChange={e => update('sireId', e.target.value)}
              placeholder="Father's ear tag number"
            />
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e => update('purchaseDate', e.target.value)} />
            <Input
              label="Source / Vendor"
              value={form.purchaseSource}
              onChange={e => update('purchaseSource', e.target.value)}
              placeholder="e.g. McGregor Farms, Livestock Auction"
            />
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          <SectionHeader title="Notes" />
          <textarea
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes, observations, medical history…"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
          />
        </div>

        <div className="pb-10">
          <Button size="lg" fullWidth loading={saving} disabled={!canSave} onClick={handleSave}>
            Register Animal
          </Button>
          {!canSave && (
            <p className="text-xs text-gray-400 text-center mt-2">Species and tag number are required</p>
          )}
        </div>
      </div>
    </div>
  )
}
