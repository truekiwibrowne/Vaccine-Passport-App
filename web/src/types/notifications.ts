/**
 * In-app notification records stored at User_Notifications/{uid}/items/{id}.
 * Written by admin actions (approve / reject); read by the owning user.
 */

export type NotificationType = 'approval' | 'rejection'
export type NotificationSubject = 'clinic' | 'practitioner' | 'vaccine'

export interface UserNotification {
  id: string
  type:     NotificationType
  subject:  NotificationSubject
  title:    string
  body:     string
  read:     boolean
  createdAt: string   // ISO timestamp
  /** For vaccine approvals: the Vaccine_Library entry id that was created */
  vaccineLibraryId?: string
  /** For vaccine approvals: the User_Data vaccine record id that was auto-created */
  userVaccineId?: string
}
