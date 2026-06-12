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

// ── Per-disease travel risk regions ──────────────────────────────────────────
//
// Maps lowercase disease-target substrings to the regions / countries where
// that disease poses a genuine travel risk, based on:
//   • CDC Travelers' Health  (https://wwwnc.cdc.gov/travel)
//   • WHO International Travel and Health, 2024 edition
//
// A disease only gets a travel-mode boost when the user's entered destination
// matches one of its risk regions.  This prevents, e.g., rabies appearing as
// high-priority when travelling to New Zealand (which is rabies-free).
//
// TODO: Consider migrating this data to a Firestore collection so admins can
// update it without a code deployment.

const DISEASE_RISK_REGIONS: Record<string, string[]> = {

  // Yellow Fever — Sub-Saharan Africa + Amazon basin (required for entry in many countries)
  'yellow fever': [
    // Africa
    'africa', 'sub-saharan', 'tropical',
    'angola', 'benin', 'burkina faso', 'burundi', 'cameroon', 'central african',
    'chad', 'congo', 'drc', 'equatorial guinea', 'ethiopia', 'gabon', 'ghana',
    'guinea', 'ivory coast', "cote d'ivoire", 'kenya', 'liberia', 'madagascar',
    'mali', 'mozambique', 'niger', 'nigeria', 'rwanda', 'senegal', 'sierra leone',
    'somalia', 'south sudan', 'sudan', 'tanzania', 'togo', 'uganda',
    'zambia', 'zimbabwe',
    // South America — Amazon and tropical zones
    'amazon', 'brazil', 'bolivia', 'colombia', 'ecuador', 'french guiana',
    'guyana', 'peru', 'suriname', 'trinidad', 'venezuela',
    'latin america', 'south america',
  ],

  // Typhoid — developing world with poor sanitation
  'typhoid': [
    // South Asia
    'india', 'pakistan', 'bangladesh', 'nepal', 'sri lanka', 'bhutan', 'south asia',
    // Southeast Asia
    'cambodia', 'indonesia', 'laos', 'malaysia', 'myanmar', 'philippines',
    'southeast asia', 'thailand', 'timor', 'vietnam',
    // East Asia
    'china', 'east asia',
    // Africa
    'africa', 'sub-saharan', 'angola', 'cameroon', 'congo', 'drc', 'ethiopia',
    'ghana', 'kenya', 'madagascar', 'mali', 'mozambique', 'nigeria',
    'senegal', 'somalia', 'south sudan', 'sudan', 'tanzania', 'uganda', 'zambia',
    // Middle East / North Africa
    'egypt', 'iraq', 'jordan', 'morocco', 'north africa', 'pakistan', 'tunisia',
    // Latin America
    'bolivia', 'brazil', 'central america', 'colombia', 'el salvador', 'guatemala',
    'haiti', 'honduras', 'latin america', 'mexico', 'nicaragua', 'peru',
    // Eastern Europe
    'eastern europe', 'russia',
  ],

  // Hepatitis A — faecal-oral, widespread in developing world
  'hepatitis a': [
    // South / Southeast Asia
    'india', 'pakistan', 'bangladesh', 'nepal', 'south asia',
    'cambodia', 'indonesia', 'laos', 'myanmar', 'philippines', 'southeast asia',
    'thailand', 'vietnam',
    // Africa
    'africa', 'sub-saharan', 'egypt', 'ethiopia', 'kenya', 'morocco',
    'nigeria', 'north africa', 'tanzania', 'uganda',
    // Latin America
    'brazil', 'central america', 'colombia', 'latin america', 'mexico', 'peru',
    'haiti',
    // Middle East
    'iran', 'iraq', 'jordan', 'lebanon', 'middle east', 'turkey',
    // Eastern Europe / Russia
    'eastern europe', 'russia', 'ukraine', 'belarus', 'moldova',
    // China
    'china',
  ],

  // Cholera — poor water/sanitation; risk is low for most travellers staying in hotels
  'cholera': [
    'africa', 'sub-saharan', 'angola', 'cameroon', 'congo', 'drc', 'ethiopia',
    'ghana', 'haiti', 'kenya', 'mozambique', 'nigeria', 'somalia',
    'south sudan', 'tanzania', 'uganda', 'zambia', 'zimbabwe',
    'india', 'pakistan', 'bangladesh', 'south asia',
    'indonesia', 'philippines', 'southeast asia',
    'latin america', 'peru',
    'yemen',
  ],

  // Rabies — terrestrial (dog/bat) rabies endemic zones.
  // Notable EXCLUSIONS: Australia, New Zealand, Japan, UK, Ireland, Iceland,
  // Singapore, Taiwan, Fiji, Hawaii, most small Pacific islands.
  'rabies': [
    // South Asia (highest dog-rabies burden globally)
    'india', 'pakistan', 'bangladesh', 'nepal', 'bhutan', 'south asia', 'sri lanka',
    // Southeast Asia
    'cambodia', 'indonesia', 'laos', 'myanmar', 'malaysia', 'philippines',
    'southeast asia', 'thailand', 'vietnam', 'timor',
    // East / Central Asia
    'china', 'mongolia', 'russia', 'central asia', 'kazakhstan', 'kyrgyzstan',
    'tajikistan', 'turkmenistan', 'uzbekistan',
    // Middle East / North Africa
    'afghanistan', 'egypt', 'iran', 'iraq', 'middle east', 'morocco',
    'north africa', 'turkey', 'yemen',
    // Africa
    'africa', 'sub-saharan', 'angola', 'cameroon', 'congo', 'drc', 'ethiopia',
    'ghana', 'kenya', 'madagascar', 'mozambique', 'nigeria', 'south africa',
    'sudan', 'tanzania', 'tunisia', 'uganda',
    // Eastern Europe
    'eastern europe', 'ukraine', 'belarus', 'moldova',
    // Latin America
    'bolivia', 'brazil', 'central america', 'colombia', 'dominican republic',
    'ecuador', 'el salvador', 'guatemala', 'haiti', 'honduras',
    'latin america', 'mexico', 'nicaragua', 'peru', 'venezuela',
  ],

  // Japanese Encephalitis — rural Asia, rice-growing/pig-farming areas
  'japanese encephalitis': [
    // South Asia
    'india', 'nepal', 'sri lanka', 'south asia', 'bangladesh',
    // Southeast Asia
    'cambodia', 'indonesia', 'laos', 'malaysia', 'myanmar', 'philippines',
    'southeast asia', 'thailand', 'vietnam', 'timor',
    // East Asia
    'china', 'south korea', 'east asia',
    // Pakistan (western fringe)
    'pakistan',
  ],

  // Tick-Borne Encephalitis — forested areas of Central/Eastern Europe + Russia
  'tick-borne encephalitis': [
    'austria', 'baltic', 'balkans', 'belarus', 'central europe',
    'croatia', 'czech', 'eastern europe', 'estonia', 'finland',
    'germany', 'hungary', 'kazakhstan', 'latvia', 'lithuania',
    'mongolia', 'norway', 'poland', 'romania', 'russia', 'serbia',
    'slovakia', 'slovenia', 'sweden', 'switzerland', 'ukraine',
    'central asia',
  ],

  // Meningococcal — meningitis belt (Africa) + Hajj requirement
  'meningococcal': [
    // Meningitis belt — Sub-Saharan Africa
    'africa', 'sub-saharan', 'burkina faso', 'cameroon', 'chad', 'congo',
    'drc', 'ethiopia', 'gambia', 'ghana', 'guinea', 'mali', 'niger',
    'nigeria', 'senegal', 'sierra leone', 'south sudan', 'sudan', 'togo', 'uganda',
    // Saudi Arabia (required for Hajj/Umrah pilgrims)
    'saudi arabia',
    // South Asia (elevated carriage rates)
    'india', 'south asia',
  ],

  // Polio — still circulating in a handful of countries; also relevant for
  // travellers whose routine vaccination may have lapsed
  'polio': [
    'afghanistan', 'pakistan',                          // ongoing wild poliovirus
    'nigeria', 'congo', 'drc', 'somalia', 'africa',    // cVDPV outbreaks
    'india', 'south asia',
    'indonesia', 'southeast asia',
  ],
}

// ── Vaccines recommended for *any* international travel ───────────────────────
// These get a small boost whenever a travel destination is set, regardless of
// which country, because they are universally recommended by CDC/WHO for
// travellers who may not be up-to-date.
const ROUTINE_TRAVEL_DISEASES = ['hepatitis b', 'influenza', 'tetanus']

/**
 * Returns the set of disease-target substrings (lowercase) that pose a genuine
 * travel risk for the given destination string.
 */
function getTravelDiseases(destLower: string): string[] {
  const relevant: string[] = []
  for (const [disease, regions] of Object.entries(DISEASE_RISK_REGIONS)) {
    if (regions.some(r => destLower.includes(r) || r.includes(destLower))) {
      relevant.push(disease)
    }
  }
  return relevant
}

// ── Age helper ────────────────────────────────────────────────────────────────

function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

// ── Core scorer ───────────────────────────────────────────────────────────────

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
      if (farmSpecies && farmSpecies.size > 0) {
        const allowed = buildAllowedTypes(farmSpecies, FARM_TO_ANIMAL_TYPES)
        if (!animalVaccineMatchesSpecies(entry, allowed)) return 0
      }
    } else {
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
    // ── TRAVEL MODE ──────────────────────────────────────────────────────────
    // 1. Direct geographic match in the library entry's own data
    if (geo.includes(travelLower) || prevalence.includes(travelLower)) score += 30

    // 2. Disease-specific boost — only for diseases that are genuinely endemic
    //    at the destination (per CDC/WHO data).  This is the key fix: rabies,
    //    yellow fever, etc. do NOT boost for destinations where they don't exist
    //    (e.g. New Zealand, Australia, Japan, UK, Western Europe).
    const travelDiseases = getTravelDiseases(travelLower)
    if (travelDiseases.some(d => disease.includes(d))) score += 20

    // 3. Small boost for vaccines universally recommended for international
    //    travel regardless of destination (hepatitis B, flu, tetanus top-up)
    if (ROUTINE_TRAVEL_DISEASES.some(d => disease.includes(d))) score += 6

  } else {
    // ── HOME/CURRENT LOCATION MODE ───────────────────────────────────────────
    // Use the best available current location: IP > manual > passport
    const locationCheck = ipLower || currentLower || passportLower
    if (locationCheck && (geo.includes(locationCheck) || prevalence.includes(locationCheck))) {
      score += 25
    }
    // Travel diseases are still mildly elevated even at home (routine awareness)
    const homeDiseases = getTravelDiseases(locationCheck)
    if (homeDiseases.some(d => disease.includes(d))) score += 5
  }

  // ── Secondary boost for passport country when the user is elsewhere ─────────
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

  return Math.max(0, Math.min(100, score))
}

export function relevanceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 65) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}
