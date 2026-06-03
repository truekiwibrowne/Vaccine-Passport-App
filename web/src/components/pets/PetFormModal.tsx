/**
 * PetFormModal — reusable add / edit modal for a pet profile.
 *
 * Handles all form state, photo compression, and Firestore writes internally.
 * Callers receive the saved Pet object via onSaved so they can update their
 * local state without re-fetching.
 */

import { useState, useRef, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { addPet, updatePet, deleteField } from '../../services/petsService'
import { uploadFile } from '../../services/storageService'
import type { Pet, PetSpecies } from '../../types/pet'
import { PET_SPECIES_LABELS, PET_SPECIES_EMOJI } from '../../types/pet'

const ALL_SPECIES: PetSpecies[] = [
  'dog', 'cat', 'bird', 'rabbit', 'horse', 'guinea_pig', 'reptile', 'fish', 'other',
]

export interface PetFormModalProps {
  open: boolean
  onClose: () => void
  /** null → add new pet; Pet → edit existing */
  editing: Pet | null
  userId: string
  /** Called with the full Pet object after a successful save */
  onSaved: (pet: Pet, isNew: boolean) => void
}

export function PetFormModal({ open, onClose, editing, userId, onSaved }: PetFormModalProps) {
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    species: '' as PetSpecies | '',
    breed: '',
    dateOfBirth: '',
    chipId: '',
    identificationNumber: '',
  })

  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Reset / populate form whenever the modal opens or the target pet changes
  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        name:                 editing.name,
        species:              editing.species,
        breed:                editing.breed ?? '',
        dateOfBirth:          editing.dateOfBirth ?? '',
        chipId:               editing.chipId ?? '',
        identificationNumber: editing.identificationNumber ?? '',
      })
      setPhotoPreview(editing.profileImage ?? null)
    } else {
      setForm({ name: '', species: '', breed: '', dateOfBirth: '', chipId: '', identificationNumber: '' })
      setPhotoPreview(null)
    }
    setPhotoFile(null)
    setPhotoRemoved(false)
  }, [open, editing])

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoRemoved(false)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    if (!form.name.trim() || !form.species) return
    setSaving(true)
    try {
      // Resolve profile image
      let resolvedImage: string | undefined
      let removeImage = false
      if (photoFile) {
        resolvedImage = await uploadFile(userId, photoFile, 'profile')
      } else if (photoRemoved) {
        removeImage = true
      } else {
        resolvedImage = editing?.profileImage
      }

      if (editing) {
        // Use deleteField() for optional fields that were cleared
        const updateData: Record<string, unknown> = {
          name:                 form.name.trim(),
          species:              form.species as PetSpecies,
          breed:                form.breed.trim()                || deleteField(),
          dateOfBirth:          form.dateOfBirth                 || deleteField(),
          chipId:               form.chipId.trim()               || deleteField(),
          identificationNumber: form.identificationNumber.trim() || deleteField(),
        }
        if (removeImage)        updateData.profileImage = deleteField()
        else if (resolvedImage) updateData.profileImage = resolvedImage

        await updatePet(userId, editing.id, updateData)

        const updated: Pet = {
          ...editing,
          name:                 form.name.trim(),
          species:              form.species as PetSpecies,
          breed:                form.breed.trim()                || undefined,
          dateOfBirth:          form.dateOfBirth                 || undefined,
          chipId:               form.chipId.trim()               || undefined,
          identificationNumber: form.identificationNumber.trim() || undefined,
          profileImage:         removeImage ? undefined : (resolvedImage ?? editing.profileImage),
        }
        onSaved(updated, false)

      } else {
        const addData: Omit<Pet, 'id' | 'createdAt' | 'ownerId' | 'members'> = {
          name:    form.name.trim(),
          species: form.species as PetSpecies,
          ...(form.breed.trim()                ? { breed:                form.breed.trim() }                : {}),
          ...(form.dateOfBirth                 ? { dateOfBirth:          form.dateOfBirth }                 : {}),
          ...(form.chipId.trim()               ? { chipId:               form.chipId.trim() }               : {}),
          ...(form.identificationNumber.trim() ? { identificationNumber: form.identificationNumber.trim() } : {}),
          ...(resolvedImage                    ? { profileImage:         resolvedImage }                    : {}),
        }
        const id = await addPet(userId, addData)
        const newPet: Pet = {
          id,
          ...addData,
          ownerId:   userId,
          members:   [userId],
          createdAt: new Date().toISOString(),
        }
        onSaved(newPet, true)
      }

      onClose()
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Pet' : 'Add Pet'}>
      <div className="flex flex-col gap-4">

        {/* ── Photo picker ── */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="relative group"
            title="Add or change photo"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-500 group-hover:border-blue-400 transition-colors">
              {photoPreview ? (
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">
                  {form.species ? PET_SPECIES_EMOJI[form.species as PetSpecies] : '🐾'}
                </span>
              )}
            </div>
            {/* Camera badge */}
            <div className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-blue-600 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {photoPreview ? 'Tap to change photo' : 'Tap to add a photo'}
          </p>
          {photoPreview && (
            <button
              type="button"
              onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoRemoved(true) }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Remove photo
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelected}
          />
        </div>

        {/* ── Name ── */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Pet's name"
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ── Species ── */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Species *</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_SPECIES.map(sp => (
              <button
                key={sp}
                type="button"
                onClick={() => setForm(f => ({ ...f, species: sp }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  form.species === sp
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">{PET_SPECIES_EMOJI[sp]}</span>
                {PET_SPECIES_LABELS[sp]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Breed ── */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Breed (optional)</label>
          <input
            type="text"
            value={form.breed}
            onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
            placeholder="e.g. Golden Retriever"
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ── Date of Birth ── */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Date of Birth (optional)</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ── Identification ── */}
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Identification</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Microchip ID (optional)</label>
              <input
                type="text"
                value={form.chipId}
                onChange={e => setForm(f => ({ ...f, chipId: e.target.value }))}
                placeholder="e.g. 985 141 000 124 332"
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ISO 11784/11785 RFID chip number</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Other ID (optional)</label>
              <input
                type="text"
                value={form.identificationNumber}
                onChange={e => setForm(f => ({ ...f, identificationNumber: e.target.value }))}
                placeholder="e.g. licence, tattoo, tag number"
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button
            fullWidth
            loading={saving}
            disabled={!form.name.trim() || !form.species}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
