import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ValidationRequest } from '../types/validation'
import { isoNow } from '../utils/dateUtils'
import { getPractitionerByEmail } from './practitionersService'

export async function createValidationRequest(data: Omit<ValidationRequest, 'request_id' | 'status' | 'responded_at' | 'validator_notes' | 'authentication_level'>): Promise<string> {
  const ref = await addDoc(collection(db, 'Validation_Requests'), {
    ...data,
    status: 'pending',
    responded_at: null,
    validator_notes: '',
    authentication_level: 0,
  })

  // Mark vaccine as pending
  await updateDoc(doc(db, 'User_Data', data.user_id, 'Vaccines', data.user_vaccine_id), {
    pending_validation: true,
    validator_email: data.validator_email,
  })

  return ref.id
}

export async function getValidatorRequests(validatorEmail: string): Promise<ValidationRequest[]> {
  const snap = await getDocs(
    query(collection(db, 'Validation_Requests'), where('validator_email', '==', validatorEmail))
  )
  return snap.docs.map(d => ({ ...d.data(), request_id: d.id }) as ValidationRequest)
}

/**
 * Approve a validation request.
 * The authentication_level is auto-computed from the practitioner's verificationLevel:
 *   authentication_level = min(practitioner.verificationLevel + 1, 5)
 * If the validator is not in the Practitioners collection they are treated as level 0
 * (unregistered), so the vaccine gets authentication_level 1.
 */
export async function approveValidation(
  request: ValidationRequest,
  notes: string
): Promise<{ authLevel: number }> {
  const now = isoNow()

  // Look up practitioner to determine their trust level
  const practitioner = await getPractitionerByEmail(request.validator_email)
  const practitionerLevel = practitioner?.verificationLevel ?? 0
  const authLevel = Math.min(practitionerLevel + 1, 5)

  const batch = writeBatch(db)
  const vaccinesRef = doc(db, 'User_Data', request.user_id, 'Vaccines', request.user_vaccine_id)
  const pubVaccineRef = doc(db, 'User_Data', request.user_id, 'Public_Vaccines', request.user_vaccine_id)
  const reqRef = doc(db, 'Validation_Requests', request.request_id)

  // Use set+merge so these work even if the public doc doesn't exist yet
  // (e.g. vaccine was added before the dual-write was implemented).
  batch.set(reqRef, { status: 'approved', responded_at: now, validator_notes: notes, authentication_level: authLevel }, { merge: true })
  batch.set(vaccinesRef, {
    Authenticated: true,
    Authentication_Date: now,
    authentication_level: authLevel,
    Authenticator: request.validator_email,
    pending_validation: false,
    Updated: now,
  }, { merge: true })
  batch.set(pubVaccineRef, {
    Authenticated: true,
    Authentication_Date: now,
    authentication_level: authLevel,
  }, { merge: true })

  await batch.commit()
  return { authLevel }
}

export async function rejectValidation(request: ValidationRequest, notes: string): Promise<void> {
  const now = isoNow()
  const batch = writeBatch(db)

  batch.update(doc(db, 'Validation_Requests', request.request_id), {
    status: 'rejected', responded_at: now, validator_notes: notes,
  })
  batch.update(doc(db, 'User_Data', request.user_id, 'Vaccines', request.user_vaccine_id), {
    Authenticated: false,
    pending_validation: false,
    Updated: now,
  })

  await batch.commit()
}
