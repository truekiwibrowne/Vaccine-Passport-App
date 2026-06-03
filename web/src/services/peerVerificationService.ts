import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { PeerVerification } from '../types/admin'
import { isoNow } from '../utils/dateUtils'

/**
 * Submit a request to be upgraded to a higher verification level.
 * The approver must be a practitioner whose level is at least (targetLevel + 1).
 */
export async function createPeerVerificationRequest(params: {
  requesterUid: string
  requesterEmail: string
  requesterName: string
  approverEmail: string
  targetLevel: number
  notes: string
}): Promise<string> {
  const ref = await addDoc(collection(db, 'Peer_Verifications'), {
    requester_uid: params.requesterUid,
    requester_email: params.requesterEmail.toLowerCase(),
    requester_name: params.requesterName,
    approver_email: params.approverEmail.toLowerCase(),
    target_level: params.targetLevel,
    status: 'pending',
    notes: params.notes,
    created_at: isoNow(),
    responded_at: '',
    response_notes: '',
  })
  return ref.id
}

/** Pending requests where I am the approver — shown in the inbox. */
export async function getPendingRequestsForApprover(
  approverEmail: string
): Promise<PeerVerification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'Peer_Verifications'),
      where('approver_email', '==', approverEmail.toLowerCase()),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    )
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as PeerVerification)
}

/** All requests I have submitted (any status). */
export async function getMyPeerVerificationRequests(
  requesterUid: string
): Promise<PeerVerification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'Peer_Verifications'),
      where('requester_uid', '==', requesterUid),
      orderBy('created_at', 'desc')
    )
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as PeerVerification)
}

/** Approve a pending request (just the Peer_Verifications doc; caller must also upgrade Practitioners). */
export async function approvePeerVerificationDoc(
  requestId: string,
  responseNotes: string
): Promise<void> {
  await updateDoc(doc(db, 'Peer_Verifications', requestId), {
    status: 'approved',
    responded_at: isoNow(),
    response_notes: responseNotes,
  })
}

/** Reject a pending request. */
export async function rejectPeerVerificationDoc(
  requestId: string,
  responseNotes: string
): Promise<void> {
  await updateDoc(doc(db, 'Peer_Verifications', requestId), {
    status: 'rejected',
    responded_at: isoNow(),
    response_notes: responseNotes,
  })
}
