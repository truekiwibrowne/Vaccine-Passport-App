export interface Dependent {
  id: string
  /** UID of the user who created this record */
  ownerId: string
  /** All UIDs who can view and edit this record (includes ownerId) */
  members: string[]
  name: string               // first name / nickname only
  dateOfBirth?: string       // YYYY-MM-DD optional – used for age-based vaccine relevance
  biologicalSex?: string     // 'male' | 'female' | 'intersex' | prefer_not_to_say
  createdAt: string
}
