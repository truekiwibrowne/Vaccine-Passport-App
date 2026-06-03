export type PetSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'horse' | 'guinea_pig' | 'reptile' | 'fish' | 'other'

export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: 'Dog', cat: 'Cat', bird: 'Bird', rabbit: 'Rabbit',
  horse: 'Horse', guinea_pig: 'Guinea Pig', reptile: 'Reptile',
  fish: 'Fish', other: 'Other',
}

export const PET_SPECIES_EMOJI: Record<PetSpecies, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰',
  horse: '🐴', guinea_pig: '🐹', reptile: '🦎', fish: '🐟', other: '🐾',
}

export interface Pet {
  id: string
  /** UID of the user who created this record */
  ownerId: string
  /** All UIDs who can view and edit this record (includes ownerId) */
  members: string[]
  name: string
  species: PetSpecies
  breed?: string
  dateOfBirth?: string
  /** ISO 11784/11785 microchip number — 15-digit RFID (future: NFC scan) */
  chipId?: string
  /** Alternative ID: tattoo number, tag, licence number, etc. */
  identificationNumber?: string
  /** Base64 data URL for the pet's profile photo (compressed client-side) */
  profileImage?: string
  createdAt: string
}

export interface PetVaccine {
  pet_vaccine_id: string
  vaccine_name: string
  animal_vaccine_id: string
  disease_target: string
  date_administration: string
  Clinic?: string
  Doctor?: string
  Expiration_date?: string | null
  Notes?: string
  Created: string
  Updated: string
}
