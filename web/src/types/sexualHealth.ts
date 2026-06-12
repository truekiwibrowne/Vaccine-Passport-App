// ── Conditions ─────────────────────────────────────────────────────────────────

export type SHCondition =
  | 'hiv'
  | 'chlamydia'
  | 'gonorrhoea'
  | 'syphilis'
  | 'herpes_hsv1'
  | 'herpes_hsv2'
  | 'hepatitis_b'
  | 'hepatitis_c'
  | 'hpv'
  | 'mycoplasma'
  | 'trichomoniasis'
  | 'other'

export const SH_CONDITION_LABELS: Record<SHCondition, string> = {
  hiv:            'HIV',
  chlamydia:      'Chlamydia',
  gonorrhoea:     'Gonorrhoea',
  syphilis:       'Syphilis',
  herpes_hsv1:    'Herpes HSV-1 (Oral)',
  herpes_hsv2:    'Herpes HSV-2 (Genital)',
  hepatitis_b:    'Hepatitis B',
  hepatitis_c:    'Hepatitis C',
  hpv:            'HPV',
  mycoplasma:     'Mycoplasma genitalium',
  trichomoniasis: 'Trichomoniasis',
  other:          'Other',
}

// ── Results ────────────────────────────────────────────────────────────────────

export type SHResult =
  | 'negative'        // Not detected
  | 'positive'        // Detected, not on treatment
  | 'undetectable'    // HIV: on ART, viral load undetectable (U=U)
  | 'on_treatment'    // Positive, on treatment (non-HIV)
  | 'immune'          // Vaccinated & immune (e.g. Hep B)
  | 'pending'         // Awaiting results

export const SH_RESULT_LABELS: Record<SHResult, string> = {
  negative:      'Negative',
  positive:      'Positive',
  undetectable:  'Undetectable (U=U)',
  on_treatment:  'On Treatment',
  immune:        'Immune',
  pending:       'Awaiting Results',
}

export const SH_RESULT_COLOURS: Record<SHResult, { bg: string; text: string; dot: string }> = {
  negative:     { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-700 dark:text-green-300',  dot: 'bg-green-400' },
  positive:     { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-300',      dot: 'bg-red-400' },
  undetectable: { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-400' },
  on_treatment: { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-400' },
  immune:       { bg: 'bg-teal-50 dark:bg-teal-900/20',     text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-400' },
  pending:      { bg: 'bg-gray-50 dark:bg-gray-700',        text: 'text-gray-600 dark:text-gray-300',    dot: 'bg-gray-400' },
}

// ── Records ────────────────────────────────────────────────────────────────────

export interface SexualHealthRecord {
  id: string
  condition: string       // SHCondition or custom string
  result: SHResult
  testDate: string        // ISO
  clinic?: string
  clinicId?: string       // Firestore Clinics/{id} if selected from list
  practitioner?: string
  practitionerId?: string // Firestore Practitioners/{id} if selected from list
  medication?: string     // ART regimen, antibiotic, etc.
  viralLoad?: string      // 'Undetectable' or specific count for HIV
  notes?: string
  includeInShare: boolean // whether this record appears on the public QR
  // ── Validation ──
  Authenticated?: boolean
  Authentication_Date?: string
  authentication_level?: number   // 1–5 (matches vaccine trust levels)
  Authenticator?: string          // practitioner email
  pending_validation?: boolean
  validator_email?: string
  Created: string
  Updated: string
}

// ── Share settings (stored in Firestore profile) ───────────────────────────────

export interface SexualHealthConfig {
  shareEnabled: boolean
  shareToken: string          // UUID, generated once, used as public URL key
  showConditionNames: boolean // if false, QR shows "STI panel" counts only
  showMedication: boolean     // include medication on QR
  customMessage?: string      // optional note shown on QR page
  lastPublished?: string      // ISO — when summary was last pushed to public doc
  includeInPassport?: boolean // show sanitised PHR summary on the main passport QR scan page
  passportLastPublished?: string  // ISO — when PHR was last synced to public profile doc
}

// ── Curability ──────────────────────────────────────────────────────────────────
// curable:   antibiotics clear it; a later negative negates a positive
// clearable: may resolve naturally or with treatment (e.g. Hep C, HPV)
// lifelong:  manageable but permanent (HIV, herpes, Hep B)

export type SHCurability = 'curable' | 'clearable' | 'lifelong'

export const SH_CURABILITY: Record<SHCondition, SHCurability> = {
  hiv:            'lifelong',
  chlamydia:      'curable',
  gonorrhoea:     'curable',
  syphilis:       'curable',
  herpes_hsv1:    'lifelong',
  herpes_hsv2:    'lifelong',
  hepatitis_b:    'lifelong',
  hepatitis_c:    'clearable',
  hpv:            'clearable',
  mycoplasma:     'curable',
  trichomoniasis: 'curable',
  other:          'curable',
}

export const SH_CURABILITY_LABELS: Record<SHCurability, string> = {
  curable:   'Curable',
  clearable: 'Treatable / May Clear',
  lifelong:  'Lifelong (Manageable)',
}

export const SH_CURABILITY_COLOURS: Record<SHCurability, { bg: string; text: string }> = {
  curable:   { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-300' },
  clearable: { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300' },
  lifelong:  { bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-300' },
}

// ── Public summary (stored at PublicSexualHealth/{shareToken}) ─────────────────

export interface PublicSHRecord {
  conditionLabel?: string   // only if showConditionNames
  result: SHResult
  testDate: string
  medication?: string       // only if showMedication
}

export interface PublicSexualHealthDoc {
  ownerUid: string
  displayName?: string      // first name only
  lastUpdated: string
  showConditionNames: boolean
  showMedication: boolean
  customMessage?: string
  records: PublicSHRecord[]
}
