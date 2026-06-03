import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import {
  getFarmAnimal, getFarmVaccines,
  deleteFarmVaccine, updateFarmAnimal,
} from '../services/farmService'
import type { FarmAnimal, FarmVaccine, FarmSpecies, FarmSex, FarmAnimalStatus, FarmPurpose } from '../types/farm'
import {
  FARM_SPECIES_LABELS, FARM_SPECIES_CODE, ALL_FARM_SPECIES,
  FARM_SEX_LABELS, FARM_STATUS_LABELS, FARM_PURPOSE_LABELS,
  ALL_FARM_STATUSES, ALL_FARM_PURPOSES,
} from '../types/farm'
import { SpeciesBadge, StatusBadge } from './FarmPage'
import { formatDate } from '../utils/dateUtils'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { ShareManageModal } from '../components/ui/ShareManageModal'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

function DataRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium flex-shrink-0 mr-4">{label}</span>
      <span className="text-xs text-gray-900 dark:text-white text-right font-mono">{String(value)}</span>
    </div>
  )
}

export function FarmAnimalDetailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { animalId } = useParams<{ animalId: string }>()

  const [animal, setAnimal] = useState<FarmAnimal | null>(null)
  const [vaccines, setVaccines] = useState<FarmVaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const [editForm, setEditForm] = useState({
    species: '' as FarmSpecies | '',
    tagNumber: '', chipId: '', nationalId: '', name: '',
    breed: '', sex: 'unknown' as FarmSex, colour: '',
    dateOfBirth: '', weight: '', weightUnit: 'kg' as 'kg' | 'lb',
    status: 'active' as FarmAnimalStatus,
    purpose: '' as FarmPurpose | '',
    herd: '', paddock: '',
    damId: '', sireId: '', purchaseDate: '', purchaseSource: '',
    notes: '',
  })

  useEffect(() => {
    if (!animalId) return
    Promise.all([getFarmAnimal(animalId, user?.uid), getFarmVaccines(user?.uid ?? '', animalId)])
      .then(([a, vaxes]) => {
        setAnimal(a)
        setVaccines(vaxes)
      })
      .finally(() => setLoading(false))
  }, [animalId, user])

  function openEdit() {
    if (!animal) return
    setEditForm({
      species: animal.species, tagNumber: animal.tagNumber,
      chipId: animal.chipId ?? '', nationalId: animal.nationalId ?? '',
      name: animal.name ?? '', breed: animal.breed ?? '',
      sex: animal.sex ?? 'unknown', colour: animal.colour ?? '',
      dateOfBirth: animal.dateOfBirth ?? '',
      weight: animal.weight?.toString() ?? '',
      weightUnit: animal.weightUnit ?? 'kg',
      status: animal.status ?? 'active',
      purpose: animal.purpose ?? '',
      herd: animal.herd ?? '', paddock: animal.paddock ?? '',
      damId: animal.damId ?? '', sireId: animal.sireId ?? '',
      purchaseDate: animal.purchaseDate ?? '',
      purchaseSource: animal.purchaseSource ?? '',
      notes: animal.notes ?? '',
    })
    setEditOpen(true)
  }

  async function handleEditSave() {
    if (!user || !animalId || !editForm.species || !editForm.tagNumber.trim()) return
    setEditSaving(true)
    try {
      const clean = (s: string) => s.trim() || undefined
      const data = {
        species: editForm.species as FarmSpecies,
        tagNumber: editForm.tagNumber.trim(),
        chipId: clean(editForm.chipId), nationalId: clean(editForm.nationalId),
        name: clean(editForm.name), breed: clean(editForm.breed),
        sex: editForm.sex as FarmSex, colour: clean(editForm.colour),
        dateOfBirth: editForm.dateOfBirth || undefined,
        weight: editForm.weight ? parseFloat(editForm.weight) : undefined,
        weightUnit: editForm.weight ? editForm.weightUnit : undefined,
        status: editForm.status as FarmAnimalStatus,
        purpose: (editForm.purpose || undefined) as FarmPurpose | undefined,
        herd: clean(editForm.herd), paddock: clean(editForm.paddock),
        damId: clean(editForm.damId), sireId: clean(editForm.sireId),
        purchaseDate: editForm.purchaseDate || undefined,
        purchaseSource: clean(editForm.purchaseSource),
        notes: clean(editForm.notes),
      }
      await updateFarmAnimal(user.uid, animalId, data)
      setAnimal(prev => prev ? { ...prev, ...data } : prev)
      setEditOpen(false)
    } catch {
      alert('Error saving. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteVaccine(v: FarmVaccine) {
    if (!user || !animalId) return
    if (!window.confirm(`Remove vaccine: ${v.vaccine_name}?`)) return
    try {
      await deleteFarmVaccine(user.uid, animalId, v.farm_vaccine_id)
      setVaccines(prev => prev.filter(x => x.farm_vaccine_id !== v.farm_vaccine_id))
    } catch { alert('Error deleting.') }
  }

  function handleShare() {
    if (!user || !animalId) return
    const url = `${APP_URL}/verify/farm/${user.uid}/${animalId}`
    if (navigator.share) {
      navigator.share({ title: `${animal?.tagNumber} — Vaccination Passport`, url })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied to clipboard.')
    }
  }

  const qrUrl = user && animalId ? `${APP_URL}/verify/farm/${user.uid}/${animalId}` : ''
  const pageTitle = animal
    ? `${animal.tagNumber}${animal.name ? ` — ${animal.name}` : ''}`
    : 'Animal Record'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-2 px-4 pt-safe h-14">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-sm font-mono truncate">{pageTitle}</p>
            {animal && (
              <p className="text-xs text-gray-400 dark:text-gray-500 -mt-0.5">
                {FARM_SPECIES_LABELS[animal.species]}{animal.breed ? ` · ${animal.breed}` : ''}
              </p>
            )}
          </div>
          {/* Share access button */}
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Manage shared access"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </button>
          <button onClick={openEdit} className="p-2 text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => navigate(`/farm/${animalId}/vaccines/add`)}
            className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold rounded-lg active:bg-green-800"
          >
            + Vaccine
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-4 pb-32 flex flex-col gap-4">
          {animal && (
            <>
              {/* ── Identity card ── */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Animal Record</span>
                  <div className="flex items-center gap-2">
                    <SpeciesBadge species={animal.species} />
                    <StatusBadge status={animal.status} />
                  </div>
                </div>

                <div className="px-4 py-3">
                  {/* Primary ID */}
                  <div className="mb-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tag / Primary ID</p>
                    <p className="text-2xl font-black font-mono text-gray-900 dark:text-white tracking-tight mt-0.5">
                      {animal.tagNumber}
                    </p>
                    {animal.name && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{animal.name}</p>}
                  </div>

                  {/* Data grid */}
                  <div className="grid grid-cols-2 gap-x-6">
                    <div>
                      <DataRow label="Chip ID" value={animal.chipId} />
                      <DataRow label="National ID" value={animal.nationalId} />
                      <DataRow label="Herd" value={animal.herd} />
                      <DataRow label="Paddock" value={animal.paddock} />
                      <DataRow label="Purpose" value={animal.purpose ? FARM_PURPOSE_LABELS[animal.purpose] : undefined} />
                    </div>
                    <div>
                      <DataRow label="Breed" value={animal.breed} />
                      <DataRow label="Sex" value={animal.sex ? FARM_SEX_LABELS[animal.sex] : undefined} />
                      <DataRow label="Colour" value={animal.colour} />
                      <DataRow label="DOB" value={animal.dateOfBirth ? formatDate(animal.dateOfBirth) : undefined} />
                      <DataRow label="Weight" value={animal.weight ? `${animal.weight} ${animal.weightUnit ?? 'kg'}` : undefined} />
                    </div>
                  </div>

                  {/* Provenance */}
                  {(animal.damId || animal.sireId || animal.purchaseSource || animal.purchaseDate) && (
                    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Provenance</p>
                      <DataRow label="Dam (Mother)" value={animal.damId} />
                      <DataRow label="Sire (Father)" value={animal.sireId} />
                      <DataRow label="Purchase Date" value={animal.purchaseDate ? formatDate(animal.purchaseDate) : undefined} />
                      <DataRow label="Source" value={animal.purchaseSource} />
                    </div>
                  )}

                  {animal.notes && (
                    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{animal.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── QR / Passport ── */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Vaccination Passport QR</span>
                </div>
                <div className="px-4 py-4 flex items-center gap-4">
                  <div
                    className="p-2 bg-white border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer"
                    onClick={() => setQrOpen(true)}
                  >
                    <QRCodeSVG value={qrUrl} size={72} level="M" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      Scan to view this animal's vaccination records. Share with vets, inspectors, or buyers.
                    </p>
                    <button
                      onClick={handleShare}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Copy / Share Link
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Vaccine records ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Vaccine Records ({vaccines.length})
              </span>
              <button
                onClick={() => navigate(`/farm/${animalId}/vaccines/add`)}
                className="text-xs font-semibold text-green-700 dark:text-green-400"
              >
                + Add
              </button>
            </div>

            {vaccines.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No vaccine records on file</p>
                <button
                  onClick={() => navigate(`/farm/${animalId}/vaccines/add`)}
                  className="mt-3 text-xs font-semibold text-green-700 dark:text-green-400"
                >
                  Add first vaccine record
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {vaccines.map(v => (
                  <div key={v.farm_vaccine_id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{v.vaccine_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{v.disease_target}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">
                          Admin: {formatDate(v.date_administration)}
                        </span>
                        {v.Expiration_date && (
                          <span className="text-[10px] text-gray-400">
                            Exp: {formatDate(v.Expiration_date)}
                          </span>
                        )}
                        {v.batch_number && (
                          <span className="text-[10px] font-mono text-gray-400">
                            Batch: {v.batch_number}
                          </span>
                        )}
                        {v.Clinic && <span className="text-[10px] text-gray-400">{v.Clinic}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteVaccine(v)}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 active:scale-90"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR full-screen modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Vaccination Passport">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <QRCodeSVG value={qrUrl} size={220} level="M" includeMargin />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {animal?.tagNumber} — {animal ? FARM_SPECIES_LABELS[animal.species] : ''}<br />
            Scan to verify vaccination records
          </p>
          <Button fullWidth onClick={handleShare}>Copy Share Link</Button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Animal Record">
        <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pb-2">
          {/* Species */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">Species</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_FARM_SPECIES.map(sp => (
                <button key={sp} type="button" onClick={() => setEditForm(f => ({ ...f, species: sp }))}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                    editForm.species === sp
                      ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                      : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="font-mono text-[9px] font-bold bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded w-7 text-center flex-shrink-0">
                    {FARM_SPECIES_CODE[sp]}
                  </span>
                  {FARM_SPECIES_LABELS[sp]}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'tagNumber', label: 'Tag Number *', mono: true },
            { key: 'chipId', label: 'Chip ID', mono: true },
            { key: 'nationalId', label: 'National ID', mono: true },
            { key: 'name', label: 'Name' },
            { key: 'breed', label: 'Breed' },
            { key: 'colour', label: 'Colour' },
            { key: 'herd', label: 'Herd / Flock' },
            { key: 'paddock', label: 'Paddock' },
            { key: 'damId', label: 'Dam (Mother) Tag', mono: true },
            { key: 'sireId', label: 'Sire (Father) Tag', mono: true },
            { key: 'purchaseSource', label: 'Purchase Source' },
          ].map(({ key, label, mono }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">{label}</label>
              <input
                type="text"
                value={(editForm as Record<string, string>)[key]}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${mono ? 'font-mono' : ''}`}
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Date of Birth</label>
            <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Purchase Date</label>
            <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm(f => ({ ...f, purchaseDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none" />
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_FARM_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setEditForm(f => ({ ...f, status: s }))}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                    editForm.status === s
                      ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
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
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Purpose</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_FARM_PURPOSES.map(p => (
                <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, purpose: f.purpose === p ? '' : p }))}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                    editForm.purpose === p
                      ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {FARM_PURPOSE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Sex */}
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Sex</p>
            <div className="flex flex-wrap gap-1.5">
              {(['male', 'female', 'castrated', 'unknown'] as FarmSex[]).map(s => (
                <button key={s} type="button" onClick={() => setEditForm(f => ({ ...f, sex: s }))}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                    editForm.sex === s
                      ? 'border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {FARM_SEX_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes</label>
            <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-gray-800 py-2">
            <Button variant="secondary" fullWidth onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button fullWidth loading={editSaving}
              disabled={!editForm.species || !editForm.tagNumber.trim()}
              onClick={handleEditSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share access modal */}
      {animal && (
        <ShareManageModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          resourceType="farmAnimal"
          resourceId={animal.id}
          resourceName={`${animal.tagNumber}${animal.name ? ` (${animal.name})` : ''}`}
          ownerId={animal.ownerId}
        />
      )}
    </div>
  )
}
