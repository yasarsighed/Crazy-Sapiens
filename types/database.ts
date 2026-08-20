export type UserRole = 'researcher' | 'participant' | 'admin' | 'supervisor'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  researcher_color: string | null
  avatar_url: string | null
  dashboard_prefs: { hidden?: string[]; greeting?: string | null } | null
  created_at: string
  updated_at: string | null
}

export interface Study {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  researcher_id: string
  created_at: string
  updated_at: string | null
  start_date: string | null
  end_date: string | null
  participant_count?: number
  completion_percentage?: number
}

export interface StudyInstrument {
  id: string
  study_id: string
  instrument_type: 'questionnaire' | 'iat' | 'sociogram'
  instrument_id: string
  order_index: number
  created_at: string
}

export interface Participant {
  id: string
  study_id: string
  user_id: string | null
  external_id: string | null
  status: 'invited' | 'enrolled' | 'active' | 'completed' | 'withdrawn'
  enrolled_at: string | null
  completed_at: string | null
  created_at: string
}

// Verified directly against a live row (2026-08-19) — the previous version of
// this type listed severity/message/triggered_by, none of which exist on the
// real table, and was missing several columns that do. That mismatch is what
// let app/(authenticated)/dashboard/page.tsx silently read undefined for
// every alert's severity and message for who knows how long.
export interface ClinicalAlert {
  id: string
  study_id: string | null
  participant_id: string
  questionnaire_id: string | null
  scored_result_id: string | null
  alert_level: string | null
  alert_type: string | null
  trigger_description: string | null
  trigger_item_id: string | null
  trigger_score: number | null
  trigger_threshold: number | null
  scale_name: string | null
  protocol_followed: string | null
  notified_researcher_ids: string[] | null
  notification_sent_at: string | null
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  acknowledgement_notes: string | null
  action_taken: string | null
  escalated: boolean
  escalated_to: string | null
  escalated_at: string | null
  resolved: boolean
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action_type: string
  entity_type: string
  entity_id: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface Questionnaire {
  id: string
  title: string
  description: string | null
  researcher_id: string
  is_template: boolean
  created_at: string
  updated_at: string | null
}

export interface IATTest {
  id: string
  title: string
  description: string | null
  researcher_id: string
  category_a: string
  category_b: string
  attribute_positive: string
  attribute_negative: string
  created_at: string
  updated_at: string | null
}

export interface SociogramConfig {
  id: string
  study_id: string
  prompt: string
  relationship_types: string[]
  min_selections: number
  max_selections: number
  created_at: string
}

// Dashboard-specific types
export interface DashboardStats {
  activeStudies: number
  totalParticipants: number
  responsesCollected: number
  clinicalAlerts: number
}

export interface RecentActivity {
  id: string
  type: 'enrollment' | 'completion' | 'alert' | 'response'
  message: string
  timestamp: string
  studyTitle?: string
}

// Researcher color options
export const RESEARCHER_COLORS = [
  { value: '#CE2029', label: 'Crimson' },
  { value: '#6845A5', label: 'Purple' },
  { value: '#C41890', label: 'Magenta' },
  { value: '#D06828', label: 'Burnt Orange' },
  { value: '#B8860B', label: 'Ochre' },
  { value: '#4A7A40', label: 'Forest Green' },
  { value: '#2A7A8A', label: 'Teal' },
  { value: '#444444', label: 'Charcoal' },
] as const

export type ResearcherColor = typeof RESEARCHER_COLORS[number]['value']
