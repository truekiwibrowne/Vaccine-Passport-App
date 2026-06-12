/**
 * Types for user-submitted pending requests that require admin review.
 *
 * Three flows:
 *   PendingClinic        — user requests a clinic be added to the directory
 *   PendingPractitioner  — user requests a practitioner be added
 *   PendingVaccine       — user requests a new vaccine entry in the library
 *
 * All three follow the same status lifecycle: pending → approved | rejected
 */

import type { VaccineCategory } from './vaccineLibrary'

export type PendingStatus = 'pending' | 'approved' | 'rejected'

/**
 * Captured when the user requests a new clinic or practitioner while in the
 * middle of adding a vaccine.  If present, the vaccine record is auto-created
 * when the admin approves the request so the user doesn't have to re-add it.
 */
export interface VaccineContext {
  vaccineId:   string   // Vaccine_Library document ID
  vaccineName: string
  date:        string   // ISO date string (YYYY-MM-DD)
  doctor?:     string   // already-typed doctor name (may be empty)
  /** Where to write the auto-created vaccine record */
  targetType:  'user' | 'dependent' | 'pet' | 'farm'
  targetId:    string   // uid for 'user', or the dependent/pet/animal doc ID
  /**
   * ID of the already-saved vaccine record that needs its Clinic/Doctor field
   * filled in once the pending request is approved.
   * When present the approve handler updates the existing record instead of
   * creating a new one.
   */
  userVaccineRecordId?: string
}

// ── Pending Clinic ───────────────────────────────────────────────────────────

export interface PendingClinic {
  id: string
  /** Required fields — user must provide all of these */
  name: string
  phone: string
  address: string
  city: string
  country: string
  /** Optional */
  website?: string
  notes?: string
  /** If submitted from a vaccine-add page, used to auto-create the record on approval */
  vaccineContext?: VaccineContext
  /** Submitter info */
  submittedByUid: string
  submittedByEmail: string
  submittedAt: string
  /** Review */
  status: PendingStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
}

// ── Pending Practitioner ─────────────────────────────────────────────────────

export interface PendingPractitioner {
  id: string
  /** Required */
  name: string
  clinicName: string
  /** At least one of phone / email is required */
  phone?: string
  email?: string
  /** Optional */
  speciality?: string
  notes?: string
  /** If submitted from a vaccine-add page, used to auto-create the record on approval */
  vaccineContext?: VaccineContext
  /** Submitter info */
  submittedByUid: string
  submittedByEmail: string
  submittedAt: string
  /** Review */
  status: PendingStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
}

// ── Pending Vaccine ──────────────────────────────────────────────────────────

export interface PendingVaccine {
  id: string
  /** Required */
  name: string
  category: VaccineCategory
  /** URL to a credible reference (e.g. WHO, CDC, EMA, manufacturer) — required */
  referenceUrl: string
  /** Optional but strongly encouraged */
  diseaseTarget?: string
  manufacturer?: string
  notes?: string
  /** Submitter info */
  submittedByUid: string
  submittedByEmail: string
  submittedAt: string
  /** Review */
  status: PendingStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
}
