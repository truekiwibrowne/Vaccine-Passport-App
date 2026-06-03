export type ValidationStatus = 'pending' | 'approved' | 'rejected'

export interface ValidationRequest {
  request_id: string
  user_vaccine_id: string
  user_id: string
  vaccine_name: string
  requested_at: string
  requestor_email: string
  validator_email: string
  status: ValidationStatus
  responded_at: string | null
  validator_notes: string
  authentication_level: number
}
