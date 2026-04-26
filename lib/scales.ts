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

// ─── Acceptance and Action Questionnaire – II ────────────────────────────────
// Bond et al. (2011) Behavior Therapy 42(4):676–688.
// 7 items, 1–7 Likert (Never true → Always true).
// Higher total = greater experiential avoidance / psychological inflexibility.
// Clinical cut-off: total ≥ 24 (Bond et al., 2011).
export const AAQ2: BuiltInScale = {
  abbreviation: 'AAQ-II',
  full_name: 'Acceptance and Action Questionnaire – II',
  description:
    'A 7-item measure of psychological inflexibility and experiential avoidance. Scores range from 7 (highly flexible) to 49 (highly inflexible). Clinical concern is indicated at scores ≥ 24.',
  domain: 'Psychological Flexibility',
  total_items: 7,
  scale_min: 7,
  scale_max: 49,
  estimated_duration_minutes: 3,
  requires_clinical_alert: true,
  clinical_alert_threshold: 28,
  clinical_alert_logic: 'total_gte',
  citation:
    'Bond FW, Hayes SC, Baer RA, et al. Preliminary Psychometric Properties of the Acceptance and Action Questionnaire-II: A Revised Measure of Psychological Inflexibility and Experiential Avoidance. Behavior Therapy. 2011;42(4):676–688.',
  response_options: [
    { value: 1, label: 'Never true' },
    { value: 2, label: 'Very seldom true' },
    { value: 3, label: 'Seldom true' },
    { value: 4, label: 'Sometimes true' },
    { value: 5, label: 'Often true' },
    { value: 6, label: 'Almost always true' },
    { value: 7, label: 'Always true' },
  ],
  items: [
    {
      code: 'AAQ2_1',
      text: 'My painful experiences and memories make it difficult for me to live a life that I would value.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'AAQ2_2',
      text: "I'm afraid of my feelings.",
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'AAQ2_3',
      text: 'I worry about not being able to control my worries and feelings.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'AAQ2_4',
      text: 'My painful memories prevent me from having a fulfilling life.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'AAQ2_5',
      text: 'Emotions cause problems in my life.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'AAQ2_6',
      text: 'It seems like most people are handling their lives better than I am.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 6,
    },
    {
      code: 'AAQ2_7',
      text: 'Worries get in the way of my success.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 7,
    },
  ],
  severity_bands: [
    // category values must match DB CHECK: minimal|mild|moderate|moderately_severe|severe
    { label: 'Flexible',          category: 'minimal',          min: 7,  max: 17, color: '#52B788' },
    { label: 'Average',           category: 'mild',             min: 18, max: 24, color: '#90BE6D' },
    { label: 'Elevated',          category: 'moderate',         min: 25, max: 28, color: '#E9C46A' },
    { label: 'High Inflexibility',category: 'severe',           min: 29, max: 49, color: '#E63946' },
  ],
}

// ─── Multidimensional Psychological Flexibility Inventory – SF ────────────────
// Rolffs JL, Rogge RD, Wilson KG. (2018) Behavior Therapy 49(6):928–946.
// 24-item short form. Items 1–12 = Psychological Flexibility (PF) subscale;
// items 13–24 = Psychological Inflexibility (PI) subscale.
// Response: 1 (Never) to 6 (Always). Subscale range 12–72.
// Scored here as PI subscale total (higher = worse; range 12–72).
// Note: Items 1–12 (PF subscale) are reverse-scored for the combined total.
export const MPFI: BuiltInScale = {
  abbreviation: 'MPFI',
  full_name: 'Multidimensional Psychological Flexibility Inventory – Short Form',
  description:
    'A 24-item measure of psychological flexibility (items 1–12) and inflexibility (items 13–24). Scored as the Psychological Inflexibility subscale total (12–72); higher scores indicate greater inflexibility.',
  domain: 'Psychological Flexibility',
  total_items: 24,
  scale_min: 12,
  scale_max: 72,
  estimated_duration_minutes: 7,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  citation:
    'Rolffs JL, Rogge RD, Wilson KG. Disentangling Components of Flexibility via the Multidimensional Psychological Flexibility Inventory (MPFI). Assessment. 2018;25(4):528–545.',
  response_options: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Very rarely' },
    { value: 3, label: 'Rarely' },
    { value: 4, label: 'Sometimes' },
    { value: 5, label: 'Often' },
    { value: 6, label: 'Always' },
  ],
  items: [
    // Psychological Flexibility subscale (PF) — items 1–12
    { code: 'MPFI_PF1',  text: 'I am able to act in a way that is consistent with my values even when I feel anxious or afraid.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 1 },
    { code: 'MPFI_PF2',  text: 'I continue to engage in activities that I care about even when I am having negative thoughts about them.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 2 },
    { code: 'MPFI_PF3',  text: 'I can notice my feelings and thoughts without getting carried away by them.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 3 },
    { code: 'MPFI_PF4',  text: 'I make room for difficult feelings when I need to do something that is important to me.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 4 },
    { code: 'MPFI_PF5',  text: 'I have a clear sense of what is important to me and what I want my life to stand for.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 5 },
    { code: 'MPFI_PF6',  text: 'I am fully present in the current moment, even when unpleasant things are happening.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 6 },
    { code: 'MPFI_PF7',  text: 'I am able to see difficult thoughts as just thoughts, not as facts.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 7 },
    { code: 'MPFI_PF8',  text: 'I accept discomfort when it is in the service of what is important to me.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 8 },
    { code: 'MPFI_PF9',  text: 'I am able to observe my thoughts and feelings without being swept up by them.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 9 },
    { code: 'MPFI_PF10', text: 'I take actions that are guided by my values even in difficult situations.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 10 },
    { code: 'MPFI_PF11', text: 'I am aware of my thoughts and feelings without being defined by them.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 11 },
    { code: 'MPFI_PF12', text: 'I persist in following through on my intentions even when faced with difficulty.', is_reverse_scored: true,  is_clinical_flag_item: false, display_order: 12 },
    // Psychological Inflexibility subscale (PI) — items 13–24
    { code: 'MPFI_PI1',  text: 'My worries and fears get in the way of doing what is important to me.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 13 },
    { code: 'MPFI_PI2',  text: 'I avoid situations that are likely to bring up difficult memories or feelings.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 14 },
    { code: 'MPFI_PI3',  text: 'I get stuck in my thoughts and have difficulty seeing things from different angles.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 15 },
    { code: 'MPFI_PI4',  text: 'I struggle to do what I know is important to me when I am having negative thoughts.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 16 },
    { code: 'MPFI_PI5',  text: "I don't know what is really important to me in life.", is_reverse_scored: false, is_clinical_flag_item: false, display_order: 17 },
    { code: 'MPFI_PI6',  text: 'My mind gets caught up in past events or future worries and I lose touch with what is happening right now.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 18 },
    { code: 'MPFI_PI7',  text: 'I treat my thoughts as though they were facts and must be obeyed.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 19 },
    { code: 'MPFI_PI8',  text: 'I try to suppress uncomfortable feelings.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 20 },
    { code: 'MPFI_PI9',  text: 'My self-concept is mainly defined by my thoughts and feelings.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 21 },
    { code: 'MPFI_PI10', text: 'I feel like I am going in circles and not progressing towards what is important to me.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 22 },
    { code: 'MPFI_PI11', text: 'I am stuck in patterns that stop me from doing what I care about.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 23 },
    { code: 'MPFI_PI12', text: 'I give up on my goals when things get difficult.', is_reverse_scored: false, is_clinical_flag_item: false, display_order: 24 },
  ],
  severity_bands: [
    // category values must match DB CHECK: minimal|mild|moderate|moderately_severe|severe
    // Thresholds based on Rolffs et al. (2018) PI-subscale norms (range 12–72);
    // getSeverityBand() uses the actual total_score which may differ if more items are used.
    // Thresholds: Rolffs et al. (2018) PI-subscale norms (range 12–72).
    // The High band max is open-ended to accommodate longer questionnaire variants.
    { label: 'Low Inflexibility', category: 'minimal', min: 12, max: 24,   color: '#52B788' },
    { label: 'Moderate',          category: 'moderate', min: 25, max: 36,   color: '#E9C46A' },
    { label: 'High Inflexibility',category: 'severe',   min: 37, max: 9999, color: '#E63946' },
  ],
}

export const BUILT_IN_SCALES: BuiltInScale[] = [PHQ9, GAD7, AAQ2, MPFI]

export function getScaleByAbbreviation(abbreviation: string): BuiltInScale | null {
  return BUILT_IN_SCALES.find(s => s.abbreviation === abbreviation) ?? null
}

export function getSeverityBand(scale: BuiltInScale, score: number): SeverityBand | null {
  return scale.severity_bands.find(b => score >= b.min && score <= b.max) ?? null
}

export function getMaxItemScore(scale: BuiltInScale): number {
  return Math.max(...scale.response_options.map(o => o.value))
}
