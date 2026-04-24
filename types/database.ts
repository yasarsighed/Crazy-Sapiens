export type UserRole = 'researcher' | 'participant' | 'admin'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  researcher_color: string | null
  avatar_url: string | null
  date_of_birth: string | null
  gender: string | null
  education_level: string | null
  occupation: string | null
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

export interface ClinicalAlert {
  id: string
  study_id: string
  participant_id: string
  severity: 'critical' | 'moderate' | 'low'
  alert_type: string
  message: string
  triggered_by: string | null
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
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
  { value: '#2D6A4F', label: 'Forest Green' },
  { value: '#1C4A8F', label: 'Navy' },
  { value: '#9A3D1A', label: 'Terracotta' },
  { value: '#9A6B00', label: 'Amber' },
  { value: '#7C3AAF', label: 'Purple' },
  { value: '#C04070', label: 'Rose' },
  { value: '#2A7A8A', label: 'Teal' },
  { value: '#444444', label: 'Charcoal' },
] as const

export type ResearcherColor = typeof RESEARCHER_COLORS[number]['value']
