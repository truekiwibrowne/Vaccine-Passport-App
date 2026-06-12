/** Whether the user primarily uses the app for personal/pets or farm/commercial operations */
export type AppMode = 'personal' | 'farm'

export interface UserProfile {
  user_id: string           // Firebase Auth UID
  Full_Name: string
  Email: string
  Username: string
  Passport_Number: string
  Passport_Issuing_Country: string
  Admin: boolean
  Profile_Image: string     // base64 or Storage URL
  Phone_Number: string
  Date_of_Birth: string     // ISO date string YYYY-MM-DD (optional, used for age relevance)
  onboardingComplete: boolean
  healthConditions: string[]  // HealthCondition[]
  travelDestination: string   // country the user is travelling to (affects library relevance)
  currentCountry?: string     // country the user is currently in (manually set; overrides IP detection)
  gender?: string             // e.g. 'male' | 'female' | 'non-binary' | 'prefer_not_to_say'
  biologicalSex?: string      // e.g. 'male' | 'female' | 'intersex' | 'prefer_not_to_say'
  appMode?: AppMode           // 'personal' (default) | 'farm' — chosen at onboarding
  Created: string           // ISO timestamp
  Updated: string
}

export interface PublicProfile {
  firstName: string
  fullName?: string
  passportNumber?: string          // shown on scan page for identity verification
  photoURL?: string                // profile photo URL or base64
  phrSummary?: PHRPassportSummary  // present only if user has enabled "Include in Passport QR"
}

/**
 * Sanitised Private Health summary for the public scan page.
 * Contains NO condition names — only the aggregate status.
 */
export interface PHRPassportSummary {
  lastTestedDate: string    // ISO — most recent test date across all records
  isClear: boolean          // all effective results are negative/immune (curable past positives don't count)
  isOnTreatment: boolean    // at least one record is on_treatment or undetectable
  updatedAt: string         // ISO — when this summary was last published
}
