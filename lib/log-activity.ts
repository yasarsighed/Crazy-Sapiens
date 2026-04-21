import { createServiceClient } from '@/lib/supabase/service'

type ActionType =
  | 'study_created'
  | 'study_updated'
  | 'study_deleted'
  | 'instrument_added'
  | 'instrument_deleted'
  | 'participant_added'
  | 'participant_removed'
  | 'alert_acknowledged'
  | 'consent_updated'
  | 'user_role_changed'
  | 'enrollment'
  | 'completion'
  | 'alert'

type EntityType =
  | 'study'
  | 'questionnaire'
  | 'iat'
  | 'sociogram'
  | 'participant'
  | 'user'
  | 'alert'

export async function logActivity(
  userId: string,
  action: ActionType,
  entity: EntityType,
  entityId: string,
  details?: Record<string, unknown>,
) {
  try {
    const svc = createServiceClient()
    await svc.from('activity_logs').insert({
      user_id: userId,
      action_type: action,
      entity_type: entity,
      entity_id: entityId,
      details: details ?? null,
    })
  } catch {
    // Non-fatal — never let logging block the main action
  }
}
