/** Whether the clinic serves human patients, animals, or both. */
export type ClinicType = 'human' | 'veterinary' | 'both'

export const CLINIC_TYPE_LABELS: Record<ClinicType, string> = {
  human:       'Human Medicine',
  veterinary:  'Veterinary',
  both:        'Human & Veterinary',
}

export const CLINIC_TYPE_COLOURS: Record<ClinicType, string> = {
  human:       'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  veterinary:  'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  both:        'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export interface Clinic {
  id: string
  name: string
  address: string
  city: string
  country: string
  phone: string
  website: string
  /** Defaults to 'human' for legacy records without this field. */
  clinicType?: ClinicType
  verified: boolean
  Created: string
}

/** Whether a practitioner works with humans, animals, or is a veterinarian. */
export type PractitionerType = 'human' | 'veterinary'

export const PRACTITIONER_TYPE_LABELS: Record<PractitionerType, string> = {
  human:      'Human Medicine',
  veterinary: 'Veterinary',
}

export const PRACTITIONER_TYPE_COLOURS: Record<PractitionerType, string> = {
  human:      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  veterinary: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export interface Practitioner {
  id: string
  /** Firebase Auth UID — set when user self-registers; doc ID equals this value */
  uid?: string
  name: string
  email: string
  clinicId: string
  clinicName: string
  speciality: string
  /** Defaults to 'human' for legacy records without this field. */
  practitionerType?: PractitionerType
  /** 0 = unregistered, 1 = self-registered, 2 = clinic-verified, 3 = gov/board, 4 = highest-trust */
  verificationLevel: 0 | 1 | 2 | 3 | 4
  verifiedBy: string
  verifiedAt: string
  active: boolean
  Created: string
}

export type PeerVerificationStatus = 'pending' | 'approved' | 'rejected'

export interface PeerVerification {
  id: string
  requester_uid: string
  requester_email: string
  requester_name: string
  /** Email of the chosen approver */
  approver_email: string
  /** The level being requested (current + 1) */
  target_level: number
  status: PeerVerificationStatus
  notes: string
  created_at: string
  responded_at: string
  response_notes: string
}

export const VERIFICATION_LEVEL_LABELS: Record<number, string> = {
  0: 'Unregistered',
  1: 'Self-registered',
  2: 'Clinic-verified',
  3: 'Government / Board-registered',
  4: 'Highest-trust (WHO / Intl.)',
}

export const VERIFICATION_LEVEL_COLOURS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-500',
  1: 'bg-blue-50 text-blue-600',
  2: 'bg-green-50 text-green-700',
  3: 'bg-purple-50 text-purple-700',
  4: 'bg-amber-50 text-amber-700',
}

export type NotificationTarget =
  | { type: 'all' }
  | { type: 'location'; countries: string[] }
  | { type: 'gender'; value: string }
  | { type: 'biologicalSex'; value: string }
  | { type: 'ageRange'; minAge?: number; maxAge?: number }
  | { type: 'hasVaccine'; vaccineName: string }
  | { type: 'missingVaccine'; vaccineName: string }

export type NotificationStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'

export interface ScheduledNotification {
  id: string
  title: string
  body: string
  imageUrl?: string
  actionUrl?: string
  targets: NotificationTarget[]
  scheduledAt: string        // ISO — when to send (or send immediately if in the past when created)
  status: NotificationStatus
  sentAt?: string
  sentCount?: number
  failedCount?: number
  createdBy: string
  createdAt: string
  updatedAt: string
}
