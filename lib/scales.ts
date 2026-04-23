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

// ─── Explicit Gender-Career Attitudes (EGA-C) ─────────────────────────────────
// Companion to the Gender-Career IAT. 7 items derived from the Attitudes Toward
// Women Scale (Spence & Helmreich 1978) and Role Congruity Theory measures
// (Eagly & Karau 2002). Higher score = more traditional gender-role attitudes.
// Items reverse-scored where noted bring the scale into the same direction.
export const EGA_CAREER: BuiltInScale = {
  abbreviation: 'EGA-C',
  full_name: 'Explicit Gender-Career Attitudes Scale',
  description: 'A 7-item self-report scale measuring explicit attitudes toward gender roles in professional and domestic life. Scores range from 7 to 35; higher scores indicate more traditional gender-role attitudes.',
  domain: 'Gender Attitudes',
  total_items: 7,
  scale_min: 7,
  scale_max: 35,
  estimated_duration_minutes: 2,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  citation: 'Spence JT, Helmreich RL. Masculinity and Femininity. Austin: University of Texas Press; 1978. Eagly AH, Karau SJ. Role congruity theory of prejudice toward female leaders. Psychol Rev. 2002;109(3):573–598.',
  response_options: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  items: [
    {
      code: 'EGA_C_1',
      text: 'Men are generally better suited to leadership and professional roles than women.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'EGA_C_2',
      text: 'Women are just as competent as men in demanding professional and leadership fields.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'EGA_C_3',
      text: 'The primary role of a woman should be to manage the home and family.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'EGA_C_4',
      text: 'Men and women should have completely equal career and leadership opportunities.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'EGA_C_5',
      text: 'It makes sense that most senior managers and executives are men.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'EGA_C_6',
      text: 'A woman can be just as effective a manager or leader as a man.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 6,
    },
    {
      code: 'EGA_C_7',
      text: 'Families function better when the father focuses on career and the mother on childcare.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 7,
    },
  ],
  severity_bands: [
    { label: 'Egalitarian', category: 'egalitarian', min: 7, max: 14, color: '#52B788' },
    { label: 'Slightly traditional', category: 'slight', min: 15, max: 21, color: '#90BE6D' },
    { label: 'Moderately traditional', category: 'moderate', min: 22, max: 28, color: '#E9C46A' },
    { label: 'Strongly traditional', category: 'strong', min: 29, max: 35, color: '#E76F51' },
  ],
}

// ─── Explicit Gender-Science Attitudes (EGA-S) ────────────────────────────────
// Companion to the Gender-Science IAT. 6 items based on Nosek et al. (2002)
// companion measures. Higher score = stronger gender-science stereotype
// (men = science; women = arts).
export const EGA_SCIENCE: BuiltInScale = {
  abbreviation: 'EGA-S',
  full_name: 'Explicit Gender-Science Attitudes Scale',
  description: 'A 6-item self-report scale measuring explicit attitudes toward gender and science/mathematics. Scores range from 6 to 30; higher scores indicate stronger endorsement of the stereotype that science is a male domain.',
  domain: 'Gender Attitudes',
  total_items: 6,
  scale_min: 6,
  scale_max: 30,
  estimated_duration_minutes: 2,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  citation: 'Nosek BA, Banaji MR, Greenwald AG. Math = male, me = female, therefore math ≠ me. J Pers Soc Psychol. 2002;83(1):44–59.',
  response_options: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  items: [
    {
      code: 'EGA_S_1',
      text: 'Men are naturally more capable in mathematics and science than women.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'EGA_S_2',
      text: 'Women are equally suited to scientific research and engineering as men.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'EGA_S_3',
      text: 'It makes sense that most leading scientists and engineers are men.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'EGA_S_4',
      text: 'Girls should be encouraged as strongly as boys to pursue science and technology careers.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'EGA_S_5',
      text: 'Science and engineering are more naturally suited to the male mind.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'EGA_S_6',
      text: 'Both men and women are equally at home in scientific and technical fields.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 6,
    },
  ],
  severity_bands: [
    { label: 'Egalitarian', category: 'egalitarian', min: 6, max: 12, color: '#52B788' },
    { label: 'Slight stereotype', category: 'slight', min: 13, max: 18, color: '#90BE6D' },
    { label: 'Moderate stereotype', category: 'moderate', min: 19, max: 24, color: '#E9C46A' },
    { label: 'Strong stereotype', category: 'strong', min: 25, max: 30, color: '#E76F51' },
  ],
}

// ─── Explicit Intergroup Attitudes — Hindu-Muslim (EIA-HM) ────────────────────
// Companion to the Hindu-Muslim IAT. 8 items adapted from the Bogardus Social
// Distance Scale (Bogardus 1933) for the Indian Hindu-Muslim intergroup context.
// Higher score = greater intergroup bias / social distance.
export const EIA_HINDU_MUSLIM: BuiltInScale = {
  abbreviation: 'EIA-HM',
  full_name: 'Explicit Intergroup Attitudes Scale (Hindu-Muslim)',
  description: 'An 8-item self-report scale measuring explicit intergroup attitudes and social distance between Hindu and Muslim communities. Scores range from 8 to 40; higher scores indicate greater intergroup bias.',
  domain: 'Intergroup Attitudes',
  total_items: 8,
  scale_min: 8,
  scale_max: 40,
  estimated_duration_minutes: 3,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  citation: 'Bogardus ES. A social distance scale. Sociol Soc Res. 1933;17:265–271. Adapted for the Indian Hindu-Muslim intergroup context.',
  response_options: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  items: [
    {
      code: 'EIA_HM_1',
      text: 'I hold equally warm feelings toward people of the Hindu and Muslim faiths.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'EIA_HM_2',
      text: 'I feel comfortable having close friends from both Hindu and Muslim communities.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'EIA_HM_3',
      text: 'There are religious communities in India I find it harder to trust.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'EIA_HM_4',
      text: 'Both Hindu and Muslim communities make equally valuable contributions to Indian society.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'EIA_HM_5',
      text: 'I would feel comfortable if a close family member had a deep friendship with someone from the other religion.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'EIA_HM_6',
      text: 'Religious identity affects how much I trust or feel at ease with someone.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 6,
    },
    {
      code: 'EIA_HM_7',
      text: 'I believe all religious communities in India deserve equal rights and social standing.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 7,
    },
    {
      code: 'EIA_HM_8',
      text: 'Certain religious groups in India seem less aligned with national values than others.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 8,
    },
  ],
  severity_bands: [
    { label: 'Egalitarian', category: 'egalitarian', min: 8, max: 16, color: '#52B788' },
    { label: 'Slight bias', category: 'slight', min: 17, max: 24, color: '#90BE6D' },
    { label: 'Moderate bias', category: 'moderate', min: 25, max: 32, color: '#E9C46A' },
    { label: 'Strong bias', category: 'strong', min: 33, max: 40, color: '#E76F51' },
  ],
}

// ─── Explicit Political Attitudes — India (EPA-IN) ────────────────────────────
// Companion to the Modi vs Other PMs IAT. 6 items measuring explicit political
// attitudes toward Modi's leadership relative to other Indian prime ministers.
// Higher score = stronger explicit endorsement of Modi's leadership.
export const EPA_INDIA: BuiltInScale = {
  abbreviation: 'EPA-IN',
  full_name: 'Explicit Political Attitudes Scale (India)',
  description: 'A 6-item self-report scale measuring explicit attitudes toward political leadership in India, specifically toward Narendra Modi relative to other prime ministers. Scores range from 6 to 30.',
  domain: 'Political Attitudes',
  total_items: 6,
  scale_min: 6,
  scale_max: 30,
  estimated_duration_minutes: 2,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  citation: 'Developed for use as an explicit companion measure to the Modi vs Other PMs IAT. Items reflect dimensions of leader evaluation research (Bass & Riggio 2006; House et al. 2004 GLOBE study).',
  response_options: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  items: [
    {
      code: 'EPA_IN_1',
      text: 'Narendra Modi has been a more effective Prime Minister than most of his predecessors.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 1,
    },
    {
      code: 'EPA_IN_2',
      text: 'India\'s other prime ministers have been equally or more competent than Modi.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 2,
    },
    {
      code: 'EPA_IN_3',
      text: 'I feel a stronger sense of trust and confidence in Modi\'s leadership than in that of previous prime ministers.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 3,
    },
    {
      code: 'EPA_IN_4',
      text: 'Modi\'s policies have been better for India than those of other recent prime ministers.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 4,
    },
    {
      code: 'EPA_IN_5',
      text: 'I feel equally positively toward Modi and toward India\'s other prime ministers.',
      is_reverse_scored: true,
      is_clinical_flag_item: false,
      display_order: 5,
    },
    {
      code: 'EPA_IN_6',
      text: 'Modi represents a stronger and more decisive form of leadership than his predecessors.',
      is_reverse_scored: false,
      is_clinical_flag_item: false,
      display_order: 6,
    },
  ],
  severity_bands: [
    { label: 'Strong opposition', category: 'opposition_strong', min: 6, max: 12, color: '#457B9D' },
    { label: 'Moderate opposition', category: 'opposition_moderate', min: 13, max: 18, color: '#90BE6D' },
    { label: 'Moderate support', category: 'support_moderate', min: 19, max: 24, color: '#E9C46A' },
    { label: 'Strong support', category: 'support_strong', min: 25, max: 30, color: '#E76F51' },
  ],
}

export const BUILT_IN_SCALES: BuiltInScale[] = [PHQ9, GAD7, EGA_CAREER, EGA_SCIENCE, EIA_HINDU_MUSLIM, EPA_INDIA]

export function getScaleByAbbreviation(abbreviation: string): BuiltInScale | null {
  return BUILT_IN_SCALES.find(s => s.abbreviation === abbreviation) ?? null
}

export function getSeverityBand(scale: BuiltInScale, score: number): SeverityBand | null {
  return scale.severity_bands.find(b => score >= b.min && score <= b.max) ?? null
}

export function getMaxItemScore(scale: BuiltInScale): number {
  return Math.max(...scale.response_options.map(o => o.value))
}
