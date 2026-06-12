/**
 * available  — approved and on the market (default)
 * trial      — currently in clinical trials; can only be added with simultaneous validation
 * premarket  — approved in pipeline but not yet available; same restriction as trial
 */
export type VaccineStatus = 'available' | 'trial' | 'premarket'

/**
 * Unified category for all vaccine library entries.
 * human_adult  — adult human vaccines (default / legacy)
 * human_child  — paediatric vaccines
 * animal       — veterinary vaccines (pets, livestock, etc.)
 */
export type VaccineCategory = 'human_adult' | 'human_child' | 'animal'

export const VACCINE_CATEGORY_LABELS: Record<VaccineCategory, string> = {
  human_adult: 'Human — Adult',
  human_child: 'Human — Child / Paediatric',
  animal:      'Animal / Veterinary',
}

export const VACCINE_CATEGORY_COLOURS: Record<VaccineCategory, string> = {
  human_adult: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  human_child: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  animal:      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

/**
 * Optional sub-type when category === 'animal'.
 */
export type AnimalVaccineType =
  | 'cattle' | 'sheep' | 'pig' | 'poultry' | 'horse'
  | 'dog' | 'cat' | 'rabbit' | 'fish' | 'general'

export const ANIMAL_VACCINE_TYPE_LABELS: Record<AnimalVaccineType, string> = {
  cattle:   'Cattle (Bovine)',
  sheep:    'Sheep / Goats (Ovine)',
  pig:      'Swine (Porcine)',
  poultry:  'Poultry (Avian)',
  horse:    'Equine',
  dog:      'Canine',
  cat:      'Feline',
  rabbit:   'Rabbit / Lagomorph',
  fish:     'Aquatic / Fish',
  general:  'General / Multi-species',
}

export const ALL_ANIMAL_VACCINE_TYPES: AnimalVaccineType[] = [
  'cattle', 'sheep', 'pig', 'poultry', 'horse', 'dog', 'cat', 'rabbit', 'fish', 'general',
]

export const VACCINE_STATUS_LABELS: Record<VaccineStatus, string> = {
  available: 'Available',
  trial: 'Clinical Trial',
  premarket: 'Pre-market / Not yet approved',
}

export const VACCINE_STATUS_COLOURS: Record<VaccineStatus, string> = {
  available: 'bg-green-50 text-green-700',
  trial: 'bg-amber-50 text-amber-700',
  premarket: 'bg-red-50 text-red-600',
}

export interface VaccineLibraryEntry {
  id: string
  Vac_Name: string
  'Disease Target': string
  'Short Description': string
  'Long Description': string
  'Brand Name': string
  Manufacturer: string
  'Type/Technology': string
  Administration: string
  'Dosing Schedule': string
  'Storage Requirements': string
  'Efficacy Rate': string
  'Age Group': string
  'Target Population': string
  'Geographic Priority': string
  'Disease Prevalence': string
  'Special Notes': string
  /** Market/trial status — undefined or 'available' means normal approved vaccine */
  status?: VaccineStatus
  /**
   * Unified category for the library. Undefined / missing = legacy human_adult entry.
   * Filter the library by this field depending on context.
   */
  category?: VaccineCategory
  /**
   * Optional animal sub-type when category === 'animal'.
   * Stored as a comma-separated list to support multi-species vaccines.
   */
  animalTypes?: string
  /**
   * Countries that require proof of this vaccination for entry (visa / border control).
   * Comma-separated country names, e.g. "Kenya, Ghana, Brazil".
   * Displayed prominently on the library detail page and used to flag vaccines
   * as priority items on the public QR verify page.
   */
  entryRequirementCountries?: string
  /**
   * Optional clarifying note for the entry requirement, e.g.
   * "Required only if arriving from or transiting through an endemic country."
   */
  entryRequirementNote?: string
  relevanceScore?: number  // computed client-side, never stored
}
