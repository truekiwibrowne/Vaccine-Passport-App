export interface UserVaccine {
  user_vaccine_id: string
  user_id: string
  vaccine_id: string
  vaccine_name: string
  date_administration: string   // ISO timestamp
  Clinic: string
  Doctor: string
  Photo_Evidence: string        // Storage download URL
  Supporting_files: string[]
  Expiration_date: string | null
  Authenticated: boolean | null
  Authentication_Date: string | null
  authentication_level: number  // 1-5
  Vaccine_Reference: string
  Authenticator: string | null  // validator email
  Favourited: boolean
  pending_validation: boolean
  validator_email: string
  Notes?: string
  /** Copied from library entry at creation time — flags this as a border-entry-required vaccine */
  isEntryRequirement?: boolean
  Created: string
  Updated: string
}

export interface PublicVaccineRecord {
  vaccine_name: string
  Authenticated: boolean | null
  authentication_level: number
  Authentication_Date: string | null
  Expiration_date: string | null
  /**
   * True when the vaccine is required for entry into at least one country.
   * Set at record-creation time from the library entry's entryRequirementCountries field.
   * Used by the public QR verify page to always show this vaccine in the
   * "Entry Requirements" section regardless of keyword matching.
   */
  isEntryRequirement?: boolean
}
