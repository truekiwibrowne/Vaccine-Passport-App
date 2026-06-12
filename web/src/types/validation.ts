export type ValidationStatus = 'pending' | 'approved' | 'rejected'

/**
 * record_type distinguishes vaccine vs sexual-health validation requests.
 * Older documents without this field are treated as 'vaccine'.
 * user_vaccine_id is reused as the record ID regardless of type.
 */
export interface ValidationRequest {
  request_id: string
  /** Firestore record ID — Vaccines/{id} for vaccines, SexualHealth/{id} for SH */
  user_vaccine_id: string
  user_id: string
  /** For vaccines: the vaccine name. For SH: the condition label. */
  vaccine_name: string
  record_type?: 'vaccine' | 'sexual_health'   // defaults to 'vaccine' if absent
  requested_at: string
  requestor_email: string
  validator_email: string
  status: ValidationStatus
  responded_at: string | null
  validator_notes: string
  authentication_level: number
}
