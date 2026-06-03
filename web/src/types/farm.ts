/**
 * Types for the Farm / Commercial mode.
 *
 * Farm animals differ fundamentally from pets:
 *  - Primary identifier is a tag/ear-tag number, not a name
 *  - Organised into herds / flocks / batches
 *  - Full livestock management data: status, purpose, location, breeding
 *  - RFID/microchip support (ISO 11784/11785) — future NFC scan
 *  - National traceability IDs (NAIT, NLIS, UK passport, etc.)
 */

export type FarmSpecies =
  | 'cattle'
  | 'sheep'
  | 'pig'
  | 'goat'
  | 'chicken'
  | 'turkey'
  | 'duck'
  | 'horse'
  | 'rabbit'
  | 'deer'
  | 'alpaca'
  | 'llama'
  | 'goose'
  | 'other'

export type FarmSex = 'male' | 'female' | 'castrated' | 'unknown'

/** Lifecycle status of a farm animal */
export type FarmAnimalStatus = 'active' | 'sold' | 'deceased' | 'culled' | 'lost'

/** Primary production purpose */
export type FarmPurpose =
  | 'beef' | 'dairy' | 'breeding' | 'wool' | 'fibre'
  | 'eggs' | 'pork' | 'show' | 'draught' | 'other'

export const FARM_SPECIES_LABELS: Record<FarmSpecies, string> = {
  cattle:  'Cattle',
  sheep:   'Sheep',
  pig:     'Pig',
  goat:    'Goat',
  chicken: 'Chicken',
  turkey:  'Turkey',
  duck:    'Duck',
  horse:   'Horse',
  rabbit:  'Rabbit',
  deer:    'Deer',
  alpaca:  'Alpaca',
  llama:   'Llama',
  goose:   'Goose',
  other:   'Other',
}

/** Short 3-4 char codes for compact professional tables */
export const FARM_SPECIES_CODE: Record<FarmSpecies, string> = {
  cattle:  'CTL',
  sheep:   'SHP',
  pig:     'PIG',
  goat:    'GT',
  chicken: 'CHK',
  turkey:  'TKY',
  duck:    'DK',
  horse:   'HRS',
  rabbit:  'RBT',
  deer:    'DR',
  alpaca:  'ALP',
  llama:   'LM',
  goose:   'GS',
  other:   'OTH',
}

/** Legacy emoji — only used in personal/pet context, NOT in farm mode UI */
export const FARM_SPECIES_EMOJI: Record<FarmSpecies, string> = {
  cattle:  '🐄', sheep:  '🐑', pig:     '🐷', goat:    '🐐',
  chicken: '🐔', turkey: '🦃', duck:    '🦆', horse:   '🐴',
  rabbit:  '🐰', deer:   '🦌', alpaca:  '🦙', llama:   '🦙',
  goose:   '🪿', other:  '🐾',
}

export const ALL_FARM_SPECIES: FarmSpecies[] = [
  'cattle', 'sheep', 'pig', 'goat', 'chicken', 'turkey',
  'duck', 'horse', 'rabbit', 'deer', 'alpaca', 'llama', 'goose', 'other',
]

export const FARM_SEX_LABELS: Record<FarmSex, string> = {
  male:      'Male',
  female:    'Female',
  castrated: 'Castrated / Neutered',
  unknown:   'Unknown',
}

export const FARM_STATUS_LABELS: Record<FarmAnimalStatus, string> = {
  active:   'Active',
  sold:     'Sold / Transferred',
  deceased: 'Deceased',
  culled:   'Culled / Slaughtered',
  lost:     'Missing / Lost',
}

export const FARM_PURPOSE_LABELS: Record<FarmPurpose, string> = {
  beef:     'Beef',
  dairy:    'Dairy',
  breeding: 'Breeding',
  wool:     'Wool',
  fibre:    'Fibre / Fleece',
  eggs:     'Eggs / Poultry',
  pork:     'Pork',
  show:     'Show / Exhibition',
  draught:  'Draught / Work',
  other:    'Other',
}

export const ALL_FARM_STATUSES: FarmAnimalStatus[] = ['active', 'sold', 'deceased', 'culled', 'lost']
export const ALL_FARM_PURPOSES: FarmPurpose[] = [
  'beef', 'dairy', 'breeding', 'wool', 'fibre', 'eggs', 'pork', 'show', 'draught', 'other',
]

/** Valid species values for CSV import — lowercase only */
export const VALID_SPECIES_SET = new Set<string>(ALL_FARM_SPECIES)

export interface FarmAnimal {
  id: string
  /** UID of the user who created this record */
  ownerId: string
  /** All UIDs who can view and edit this record (includes ownerId) */
  members: string[]

  // ── Core identification ──────────────────────────────────────
  species:   FarmSpecies
  /** Ear tag / tattoo / primary farm ID number (required) */
  tagNumber: string
  /** ISO 11784/11785 RFID microchip — future NFC scan support */
  chipId?:   string
  /** National traceability ID: NAIT (NZ), NLIS (AU), UK cattle passport, etc. */
  nationalId?: string
  /** Optional individual name */
  name?:     string

  // ── Physical description ─────────────────────────────────────
  breed?:    string
  sex?:      FarmSex
  colour?:   string
  dateOfBirth?: string   // ISO date YYYY-MM-DD
  weight?:   number
  weightUnit?: 'kg' | 'lb'

  // ── Production / management ──────────────────────────────────
  /** Lifecycle status — determines if animal appears in active herd counts */
  status?:   FarmAnimalStatus
  /** Primary production purpose */
  purpose?:  FarmPurpose
  /** Current paddock, pen, or location name */
  paddock?:  string
  /** Herd / flock / batch group name or number */
  herd?:     string

  // ── Provenance / breeding ────────────────────────────────────
  /** Mother's tag number — for breeding programs */
  damId?:    string
  /** Father's tag number — for breeding programs */
  sireId?:   string
  purchaseDate?:   string
  purchaseSource?: string

  notes?:    string
  createdAt: string
}

export interface FarmVaccine {
  farm_vaccine_id:    string
  vaccine_name:       string
  animal_vaccine_id:  string
  disease_target:     string
  date_administration: string
  Clinic?:       string
  Doctor?:       string
  Expiration_date?: string | null
  /** Vaccine batch/lot number — critical for farm traceability */
  batch_number?: string
  Notes?:        string
  Created:       string
  Updated:       string
}

// ── CSV import helpers ───────────────────────────────────────────────────────

/** Columns that can appear in a bulk-import CSV/Excel file */
export interface FarmImportRow {
  tagNumber:      string
  species:        string
  chipId?:        string
  nationalId?:    string
  name?:          string
  breed?:         string
  sex?:           string
  colour?:        string
  dateOfBirth?:   string
  weight?:        string
  weightUnit?:    string
  status?:        string
  purpose?:       string
  herd?:          string
  paddock?:       string
  damId?:         string
  sireId?:        string
  purchaseDate?:  string
  purchaseSource?: string
  notes?:         string
}

export const IMPORT_TEMPLATE_HEADERS: (keyof FarmImportRow)[] = [
  'tagNumber', 'species', 'chipId', 'nationalId', 'name', 'breed',
  'sex', 'colour', 'dateOfBirth', 'weight', 'weightUnit',
  'status', 'purpose', 'herd', 'paddock',
  'damId', 'sireId', 'purchaseDate', 'purchaseSource', 'notes',
]

export const IMPORT_TEMPLATE_EXAMPLE: FarmImportRow[] = [
  {
    tagNumber: 'A001', species: 'cattle', chipId: '982000411234567', nationalId: 'NZ123456',
    name: 'Bessie', breed: 'Hereford', sex: 'female', colour: 'Red & White',
    dateOfBirth: '2021-03-15', weight: '450', weightUnit: 'kg',
    status: 'active', purpose: 'dairy', herd: 'Herd A', paddock: 'North',
    damId: '', sireId: '', purchaseDate: '', purchaseSource: '', notes: '',
  },
  {
    tagNumber: 'B042', species: 'sheep', chipId: '', nationalId: '',
    name: '', breed: 'Merino', sex: 'female', colour: 'White',
    dateOfBirth: '2022-06-01', weight: '65', weightUnit: 'kg',
    status: 'active', purpose: 'wool', herd: 'Flock B', paddock: 'South',
    damId: '', sireId: '', purchaseDate: '2022-08-10', purchaseSource: 'McGregor Farms', notes: '',
  },
]
