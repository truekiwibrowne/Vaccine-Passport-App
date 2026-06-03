import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import type { UserProfile } from '../types/user'
import type { UserVaccine } from '../types/vaccine'

// ── Context passed to the scorer ─────────────────────────────────────────────

export interface RelevanceContext {
  profile: UserProfile | null
  userVaccines: UserVaccine[]
  /** Travel destination (highest geo priority when set) */
  travelDestination?: string
  /**
   * Country the user has manually set as their current location in their
   * profile.  Takes priority over IP detection.
   */
  currentCountry?: string
  /** IP-detected country — fallback when no manual location is set */
  ipCountry?: string
  /** true = farm / commercial mode */
  isFarmMode?: boolean
  /**
   * PetSpecies values for every pet the user owns, e.g. {'dog','cat'}.
   * Animal vaccines for species NOT in this set are scored 0 in personal mode.
   */
  petSpecies?: Set<string>
  /**
   * FarmSpecies values for every animal on the farm, e.g. {'cattle','sheep'}.
   * Animal vaccines for species NOT in this set are scored 0 in farm mode.
   */
  farmSpecies?: Set<string>
}

// ── Species mapping helpers ───────────────────────────────────────────────────

/**
 * Maps PetSpecies ('dog','cat','bird'…) to the AnimalVaccineType keys used
 * in the vaccine library ('dog','cat','poultry'…).
 */
const PET_TO_ANIMAL_TYPES: Record<string, string[]> = {
  dog:        ['dog',     'general'],
  cat:        ['cat',     'general'],
  horse:      ['horse',   'general'],
  rabbit:     ['rabbit',  'general'],
  fish:       ['fish',    'general'],
  bird:       ['poultry', 'general'],
  guinea_pig: ['general'],
  reptile:    ['general'],
  other:      ['general'],
}

/**
 * Maps FarmSpecies to the AnimalVaccineType keys used in the vaccine library.
 */
const FARM_TO_ANIMAL_TYPES: Record<string, string[]> = {
  cattle:  ['cattle',  'general'],
  sheep:   ['sheep',   'general'],
  goat:    ['sheep',   'general'],   // goat vaccines often share the sheep category
  pig:     ['pig',     'general'],
  horse:   ['horse',   'general'],
  rabbit:  ['rabbit',  'general'],
  chicken: ['poultry', 'general'],
  turkey:  ['poultry', 'general'],
  duck:    ['poultry', 'general'],
  goose:   ['poultry', 'general'],
  deer:    ['general'],
  alpaca:  ['general'],
  llama:   ['general'],
  other:   ['general'],
}

function buildAllowedTypes(speciesSet: Set<string>, mapping: Record<string, string[]>): Set<string> {
  const result = new Set<string>()
  speciesSet.forEach(sp => {
    const mapped = mapping[sp] ?? ['general']
    mapped.forEach(t => result.add(t))
  })
  return result
}

/**
 * Returns true if the vaccine entry applies to at least one of the allowed
 * AnimalVaccineType values.  Vaccines with no animalTypes field are treated as
 * 'general' and match any allowed set that includes 'general'.
 */
function animalVaccineMatchesSpecies(
  entry: VaccineLibraryEntry,
  allowedTypes: Set<string>,
): boolean {
  if (!entry.animalTypes || entry.animalTypes.trim() === '') {
    return allowedTypes.has('general')
  }
  const types = entry.animalTypes.split(',').map(t => t.trim().toLowerCase())
  return types.some(t => allowedTypes.has(t))
}

// ── Core scorer ───────────────────────────────────────────────────────────────

const TRAVEL_DISEASES = [
  'yellow fever', 'typhoid', 'hepatitis a', 'cholera', 'rabies',
  'japanese encephalitis', 'tick-borne encephalitis', 'meningococcal',
]

function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

/**
 * Scores 0–100 how relevant a vaccine library entry is to this user.
 *
 * Animal-vaccine gating rules
 * ───────────────────────────
 * Personal mode:
 *   • No pets at all            → score = 0
 *   • Has pets, wrong species   → score = 0
 *   • Has a matching pet        → scored normally
 *
 * Farm mode:
 *   • Farm has a matching species → scored normally
 *   • Farm has no matching species → score = 0
 *   (If farmSpecies is not yet loaded the vaccine passes through at reduced
 *   score rather than falsely hiding potentially relevant entries.)
 *
 * Geographic priority (highest → lowest)
 * ──────────────────────────────────────
 *   1. travelDestination  (travel mode)
 *   2. ipCountry          (auto-detected — most accurate live location)
 *   3. currentCountry     (manually set — fallback when IP unavailable)
 *   4. Passport_Issuing_Country (home country)
 */
export function computeRelevanceScore(
  entry: VaccineLibraryEntry,
  ctx: RelevanceContext,
): number {
  const {
    profile,
    userVaccines,
    travelDestination,
    currentCountry,
    ipCountry,
    isFarmMode = false,
    petSpecies,
    farmSpecies,
  } = ctx

  const isAnimalVaccine = entry.category === 'animal'

  // ── Animal-vaccine hard gate ────────────────────────────────────────────────
  if (isAnimalVaccine) {
    if (isFarmMode) {
      // Farm mode: only score if the farm has a matching species
      if (farmSpecies && farmSpecies.size > 0) {
        const allowed = buildAllowedTypes(farmSpecies, FARM_TO_ANIMAL_TYPES)
        if (!animalVaccineMatchesSpecies(entry, allowed)) return 0
      }
      // farmSpecies not yet loaded → allow through (loading state)
    } else {
      // Personal mode: score = 0 unless user has a matching pet
      if (!petSpecies || petSpecies.size === 0) return 0
      const allowed = buildAllowedTypes(petSpecies, PET_TO_ANIMAL_TYPES)
      if (!animalVaccineMatchesSpecies(entry, allowed)) return 0
    }
  }

  let score = 50

  // Already recorded this vaccine → deprioritise
  if (userVaccines.some(v => v.vaccine_id === entry.id)) score -= 30

  const geo        = (entry['Geographic Priority'] ?? '').toLowerCase()
  const prevalence = (entry['Disease Prevalence'] ?? '').toLowerCase()
  const disease    = (entry['Disease Target'] ?? '').toLowerCase()
  const ag         = (entry['Age Group'] ?? '').toLowerCase()
  const targetPop  = (entry['Target Population'] ?? '').toLowerCase()

  // Global vaccines are always somewhat relevant
  if (geo.includes('global') || geo.includes('worldwide')) score += 10

  // ── Geographic matching ─────────────────────────────────────────────────────
  const travelLower   = (travelDestination ?? '').toLowerCase().trim()
  const currentLower  = (currentCountry ?? '').toLowerCase().trim()
  const ipLower       = (ipCountry ?? '').toLowerCase().trim()
  const passportLower = (profile?.Passport_Issuing_Country ?? '').toLowerCase().trim()

  if (travelLower) {
    // Travel mode: destination is the primary concern
    if (geo.includes(travelLower) || prevalence.includes(travelLower)) score += 30
    if (TRAVEL_DISEASES.some(d => disease.includes(d))) score += 20
  } else {
    // Use the best available current location: IP > manual > passport
    const locationCheck = ipLower || currentLower || passportLower
    if (locationCheck && (geo.includes(locationCheck) || prevalence.includes(locationCheck))) {
      score += 25
    }
    if (TRAVEL_DISEASES.some(d => disease.includes(d))) score += 8
  }

  // Secondary boost for passport country when the user is elsewhere
  const primaryLocation = ipLower || currentLower
  if (passportLower && passportLower !== primaryLocation) {
    if (geo.includes(passportLower) || prevalence.includes(passportLower)) score += 10
  }

  // ── Age-based relevance (human vaccines only) ───────────────────────────────
  if (!isAnimalVaccine) {
    const age = ageFromDob(profile?.Date_of_Birth)
    if (age !== null) {
      const isInfant = age < 2
      const isChild  = age < 12
      const isAdult  = age >= 18
      const isSenior = age >= 60

      if (ag.includes('infant') || ag.includes('0-2') || ag.includes('0-23') || ag.includes('neonate')) {
        score += isInfant ? 15 : isChild ? 5 : -10
      }
      if (ag.includes('child') || ag.includes('pediatric') || ag.includes('paediatric') ||
          ag.includes('0-5') || ag.includes('0-10') || ag.includes('school')) {
        score += isChild ? 12 : isAdult ? -5 : 0
      }
      if (ag.includes('adult') || targetPop.includes('adult')) {
        score += isAdult ? 8 : isChild ? -5 : 0
      }
      if (ag.includes('elderly') || ag.includes('senior') || ag.includes('65+') || ag.includes('60+')) {
        score += isSenior ? 15 : -8
      }
      if (ag.includes('universal') || ag.includes('all ages') || ag.includes('all age')) score += 5
    } else {
      if (ag.includes('universal') || ag.includes('all')) score += 5
    }
  }

  // ── Regional disease boosts ─────────────────────────────────────────────────
  const eastAfrica = ['kenya', 'tanzania', 'uganda', 'ethiopia', 'rwanda', 'burundi',
    'east africa', 'sub-saharan', 'africa', 'tropical']
  const checkCountry = travelLower || ipLower || currentLower || passportLower
  if (checkCountry && eastAfrica.some(r => checkCountry.includes(r))) {
    if (disease.includes('yellow fever') || disease.includes('malaria') ||
        disease.includes('typhoid')      || disease.includes('hepatitis')) {
      score += 15
    }
  }

  return Math.max(0, Math.min(100, score))
}

export function relevanceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 65) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}
