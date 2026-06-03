/**
 * Basic contraindication logic.
 * Maps health conditions → vaccine types/names that should trigger a warning.
 * This is informational only — always consult a medical professional.
 */

export type HealthCondition =
  | 'immunosuppressed'        // e.g. MS + immunosuppressants, chemotherapy, HIV
  | 'pregnant'
  | 'cardiac'
  | 'egg_allergy'
  | 'latex_allergy'
  | 'immunodeficiency'        // primary immune deficiency (different from immunosuppressed)
  | 'hiv'
  | 'cancer_treatment'

export const HEALTH_CONDITION_LABELS: Record<HealthCondition, string> = {
  immunosuppressed:   'Immunosuppressed (e.g. MS medication, biologics)',
  pregnant:           'Pregnant or planning pregnancy',
  cardiac:            'Cardiac condition (heart disease)',
  egg_allergy:        'Egg allergy',
  latex_allergy:      'Latex allergy',
  immunodeficiency:   'Primary immunodeficiency disorder',
  hiv:                'HIV positive',
  cancer_treatment:   'Undergoing cancer treatment (chemo/radiation)',
}

// Vaccine types/keywords that are LIVE vaccines
const LIVE_VACCINE_KEYWORDS = [
  'live attenuated', 'live-attenuated', 'oral polio', 'opv', 'mmr',
  'varicella', 'chickenpox', 'yellow fever', 'bcg', 'tuberculosis',
  'rotavirus', 'nasal flu', 'laiv', 'typhoid oral', 'ty21a', 'dengue',
]

// Returns a warning message if this vaccine is contraindicated for any of the user's conditions.
// Returns null if no contraindication.
export function getContraindication(
  vaccineEntry: { 'Type/Technology'?: string; Vac_Name?: string; 'Disease Target'?: string },
  conditions: HealthCondition[]
): string | null {
  if (!conditions.length) return null

  const type = (vaccineEntry['Type/Technology'] ?? '').toLowerCase()
  const name = (vaccineEntry.Vac_Name ?? '').toLowerCase()
  const disease = (vaccineEntry['Disease Target'] ?? '').toLowerCase()
  const combined = `${type} ${name} ${disease}`

  const isLive = LIVE_VACCINE_KEYWORDS.some(k => combined.includes(k))

  const warnings: string[] = []

  if (isLive && (
    conditions.includes('immunosuppressed') ||
    conditions.includes('immunodeficiency') ||
    conditions.includes('hiv') ||
    conditions.includes('cancer_treatment')
  )) {
    warnings.push('Live vaccines are generally contraindicated with your immune condition. Consult your doctor.')
  }

  if (isLive && conditions.includes('pregnant')) {
    warnings.push('Live vaccines are generally avoided during pregnancy. Consult your doctor.')
  }

  if (conditions.includes('egg_allergy') && (name.includes('influenza') || name.includes('flu') || name.includes('yellow fever'))) {
    warnings.push('This vaccine may contain egg proteins. Consult your doctor if you have an egg allergy.')
  }

  if (conditions.includes('cardiac') && name.includes('smallpox')) {
    warnings.push('Smallpox vaccine has cardiac risk. Consult your doctor.')
  }

  return warnings.length ? warnings[0] : null
}
