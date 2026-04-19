// Validated psychological scales — items, scoring bands, and clinical thresholds.
// These are the source of truth when seeding questionnaire_instruments and questionnaire_items.
// The scale_library table holds metadata; the actual item text lives here.

export type ResponseOption = {
  value: number
  label: string
}

export type ScaleItem = {
  code: string
  text: string
  helper_text?: string
  is_reverse_scored: boolean
  is_clinical_flag_item: boolean
  clinical_flag_threshold?: number
  clinical_flag_operator?: 'gte' | 'lte' | 'eq'
  clinical_flag_message?: string
  display_order: number
}

export type SeverityBand = {
  label: string
  category: string
  min: number
  max: number
  color: string
}

export type BuiltInScale = {
  abbreviation: string
  full_name: string
  description: string
  domain: string
  total_items: number
  scale_min: number
  scale_max: number
  estimated_duration_minutes: number
  response_options: ResponseOption[]
  items: ScaleItem[]
  severity_bands: SeverityBand[]
  requires_clinical_alert: boolean
  clinical_alert_threshold: number
  clinical_alert_logic: string
  citation: string
}

export const PHQ9: BuiltInScale = {
  abbreviation: 'PHQ-9',
  full_name: 'Patient Health Questionnaire-9',
  description: 'A validated 9-item self-report questionnaire for screening and measuring depression severity. Scores range from 0 to 27.',
  domain: 'Depression',
  total_items: 9,
  scale_min: 0,
  scale_max: 27,
  estimated_duration_minutes: 3,
  requires_clinical_alert: true,
  clinical_alert_threshold: 10,
  clinical_alert_logic: 'total_gte',
  citation:
    'Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: Validity of a brief depression severity measure. J Gen Intern Med. 2001;16(9):606–613.',
  response_options: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ],
  items: [
    {
      code: 'PHQ9_1',
      text: 'Little interest or pleasure in doing things',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'PHQ9_2',
      text: 'Feeling down, depressed, or hopeless',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'PHQ9_3',
      text: 'Trouble falling or staying asleep, or sleeping too much',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'PHQ9_4',
      text: 'Feeling tired or having little energy',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'PHQ9_5',
      text: 'Poor appetite or overeating',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'PHQ9_6',
      text: 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 6,
    },
    {
      code: 'PHQ9_7',
      text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 7,
    },
    {
      code: 'PHQ9_8',
      text: 'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 8,
    },
    {
      code: 'PHQ9_9',
      text: 'Thoughts that you would be better off dead or of hurting yourself in some way',
      is_reverse_scored: false,
      is_clinical_flag_item: true,
      clinical_flag_threshold: 1,
      clinical_flag_operator: 'gte',
      clinical_flag_message:
        'Participant endorsed suicidal ideation (PHQ-9 Item 9 ≥ 1). Immediate clinical review required.',
      display_order: 9,
    },
  ],
  severity_bands: [
    { label: 'Minimal', category: 'minimal', min: 0, max: 4, color: '#52B788' },
    { label: 'Mild', category: 'mild', min: 5, max: 9, color: '#90BE6D' },
    { label: 'Moderate', category: 'moderate', min: 10, max: 14, color: '#E9C46A' },
    { label: 'Moderately Severe', category: 'moderately_severe', min: 15, max: 19, color: '#F4A261' },
    { label: 'Severe', category: 'severe', min: 20, max: 27, color: '#E63946' },
  ],
}

export const GAD7: BuiltInScale = {
  abbreviation: 'GAD-7',
  full_name: 'Generalized Anxiety Disorder-7',
  description: 'A validated 7-item self-report questionnaire for screening and measuring anxiety severity. Scores range from 0 to 21.',
  domain: 'Anxiety',
  total_items: 7,
  scale_min: 0,
  scale_max: 21,
  estimated_duration_minutes: 3,
  requires_clinical_alert: true,
  clinical_alert_threshold: 10,
  clinical_alert_logic: 'total_gte',
  citation:
    'Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder. Arch Intern Med. 2006;166(10):1092–1097.',
  response_options: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ],
  items: [
    {
      code: 'GAD7_1',
      text: 'Feeling nervous, anxious, or on edge',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'GAD7_2',
      text: 'Not being able to stop or control worrying',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'GAD7_3',
      text: 'Worrying too much about different things',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'GAD7_4',
      text: 'Trouble relaxing',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'GAD7_5',
      text: 'Being so restless that it is hard to sit still',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'GAD7_6',
      text: 'Becoming easily annoyed or irritable',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 6,
    },
    {
      code: 'GAD7_7',
      text: 'Feeling afraid, as if something awful might happen',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 7,
    },
  ],
  severity_bands: [
    { label: 'Minimal', category: 'minimal', min: 0, max: 4, color: '#52B788' },
    { label: 'Mild', category: 'mild', min: 5, max: 9, color: '#90BE6D' },
    { label: 'Moderate', category: 'moderate', min: 10, max: 14, color: '#E9C46A' },
    { label: 'Severe', category: 'severe', min: 15, max: 21, color: '#E63946' },
  ],
}

export const BUILT_IN_SCALES: BuiltInScale[] = [PHQ9, GAD7]

export function getScaleByAbbreviation(abbreviation: string): BuiltInScale | null {
  return BUILT_IN_SCALES.find(s => s.abbreviation === abbreviation) ?? null
}

export function getSeverityBand(scale: BuiltInScale, score: number): SeverityBand | null {
  return scale.severity_bands.find(b => score >= b.min && score <= b.max) ?? null
}

export function getMaxItemScore(scale: BuiltInScale): number {
  return Math.max(...scale.response_options.map(o => o.value))
}
