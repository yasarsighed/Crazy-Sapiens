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

export type Subscale = {
  /** Short code used to group items (matches item_code prefix) */
  code: string
  label: string
  /** 'flexibility' | 'inflexibility' — for MPFI-style bidimensional scales */
  dimension?: 'flexibility' | 'inflexibility'
  item_codes: string[]
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
  /** Optional subscale definitions for multidimensional scales (e.g. MPFI) */
  subscales?: Subscale[]
  /** Plain-English scoring note shown to researchers (e.g. "Divide total by 60 to get mean 1–6") */
  scoring_note?: string
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

// ─── Acceptance and Action Questionnaire-II (AAQ-II) ─────────────────────────
// The standard self-report measure of psychological inflexibility and
// experiential avoidance in Acceptance and Commitment Therapy (ACT) research.
// Published norms (Bond et al., Behavior Therapy):
//   Non-treatment community sample  M = 18.51, SD = 7.05  (n ≈ 2,500)
//   Treatment-seeking (substance misuse) M = 28.34, SD = 9.92
//   Clinically relevant distress range: ≥ 24 (associated with GHQ-12, BDI-II,
//   and GSI values indicating psychological distress)
// Reliability: mean α = .84 across 6 samples (range .78–.88);
//   3-month test–retest r = .81; 12-month r = .79
export const AAQ2: BuiltInScale = {
  abbreviation: 'AAQ-II',
  full_name: 'Acceptance and Action Questionnaire – II',
  description:
    'A 7-item measure of psychological inflexibility and experiential avoidance '
    + 'used widely in Acceptance and Commitment Therapy research. '
    + 'Higher scores indicate greater inflexibility. '
    + 'Scores ≥ 24 are associated with clinically significant psychological distress '
    + '(Bond et al.; non-treatment sample M = 18.51, SD = 7.05).',
  domain: 'Psychological Flexibility',
  total_items: 7,
  scale_min: 7,
  scale_max: 49,
  estimated_duration_minutes: 2,
  requires_clinical_alert: true,
  clinical_alert_threshold: 24,
  clinical_alert_logic: 'total_gte',
  citation:
    'Bond, F. W., Hayes, S. C., Baer, R. A., Carpenter, K. M., Guenole, N., '
    + 'Orcutt, H. K., Waltz, T., & Zettle, R. D. (2011). '
    + 'Preliminary psychometric properties of the Acceptance and Action '
    + 'Questionnaire–II: A revised measure of psychological inflexibility '
    + 'and experiential avoidance. Behavior Therapy, 42(4), 676–688.',
  response_options: [
    { value: 1, label: 'Never true' },
    { value: 2, label: 'Very seldom true' },
    { value: 3, label: 'Seldom true' },
    { value: 4, label: 'Sometimes true' },
    { value: 5, label: 'Frequently true' },
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
      text: 'I\'m afraid of my feelings.',
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
    // Bands anchored to published non-treatment norms (M = 18.51, SD = 7.05)
    // and the clinically relevant threshold of ≥ 24 (Bond et al.)
    { label: 'Low inflexibility',              category: 'low',      min: 7,  max: 17, color: '#52B788' },
    { label: 'Average range (non-clinical)',   category: 'average',  min: 18, max: 23, color: '#90BE6D' },
    { label: 'Clinically relevant (≥ 24)',     category: 'clinical', min: 24, max: 28, color: '#E9C46A' },
    { label: 'Severe inflexibility (≥ 29)',    category: 'severe',   min: 29, max: 49, color: '#E63946' },
  ],
}

// ─── Multidimensional Psychological Flexibility Inventory (MPFI) ──────────────
// A comprehensive 60-item measure of the six flexibility and six inflexibility
// processes from the Hexaflex model (Hayes, Strosahl, & Wilson, 1999; ACT).
// Flexibility subscales (F): Acceptance, Present Moment Awareness, Self as
//   Context, Defusion, Values, Committed Action — higher = more flexible.
// Inflexibility subscales (I): Experiential Avoidance, Lack of Present Moment
//   Contact, Self as Content, Fusion, Lack of Values Contact, Inaction —
//   items are reverse-scored so that higher total = more flexible.
//
// Scoring: each item 1–6; inflexibility items reverse-scored (7 − raw).
// Total sum range: 60–360 (mean 1–6; midpoint 3.5 = neutral).
// Global flexibility composite = mean of 30 flex items (1–6).
// Global inflexibility composite = mean of 30 inflex items before reversal (1–6;
//   higher = more inflexible). Both retrievable from per-item export.
//
// No published universal clinical cutoff; interpret relative to midpoint
// and sample-specific norms from Rolffs, Rogge & Wilson (2018).
// Minimal Detectable Change (MDC95) provided per subscale in the validation
// article for tracking reliable individual change.
export const MPFI: BuiltInScale = {
  abbreviation: 'MPFI',
  full_name: 'Multidimensional Psychological Flexibility Inventory',
  description:
    'A 60-item measure of the 12 Hexaflex processes (6 flexibility + 6 inflexibility) '
    + 'from Acceptance and Commitment Therapy. Flexibility items are scored directly; '
    + 'inflexibility items are reverse-scored so the total reflects global psychological '
    + 'flexibility (sum 60–360; higher = more flexible). '
    + 'Subscale means (1–6) are available in the per-item export.',
  domain: 'Psychological Flexibility',
  total_items: 60,
  scale_min: 60,
  scale_max: 360,
  estimated_duration_minutes: 10,
  requires_clinical_alert: false,
  clinical_alert_threshold: 0,
  clinical_alert_logic: 'none',
  scoring_note:
    'Total sum ÷ 60 = global flexibility mean (1–6, midpoint 3.5). '
    + 'Subscale means: average the 5 raw items per subscale (inflexibility '
    + 'subscales: higher raw score = more inflexible). '
    + 'Use the trial-level export to compute subscale scores in R or SPSS.',
  citation:
    'Rolffs, J. L., Rogge, R. D., & Wilson, K. G. (2018). '
    + 'Disentangling components of flexibility via the Hexaflex model: '
    + 'Development and validation of the Multidimensional Psychological '
    + 'Flexibility Inventory (MPFI). Assessment, 25(4), 458–482.',
  response_options: [
    { value: 1, label: 'Never true' },
    { value: 2, label: 'Rarely true' },
    { value: 3, label: 'Occasionally true' },
    { value: 4, label: 'Often true' },
    { value: 5, label: 'Very often true' },
    { value: 6, label: 'Always true' },
  ],
  subscales: [
    { code: 'MPFI_ACC', label: 'Acceptance',                          dimension: 'flexibility',   item_codes: ['MPFI_ACC_1','MPFI_ACC_2','MPFI_ACC_3','MPFI_ACC_4','MPFI_ACC_5'] },
    { code: 'MPFI_PMA', label: 'Present Moment Awareness',            dimension: 'flexibility',   item_codes: ['MPFI_PMA_1','MPFI_PMA_2','MPFI_PMA_3','MPFI_PMA_4','MPFI_PMA_5'] },
    { code: 'MPFI_SAC', label: 'Self as Context',                     dimension: 'flexibility',   item_codes: ['MPFI_SAC_1','MPFI_SAC_2','MPFI_SAC_3','MPFI_SAC_4','MPFI_SAC_5'] },
    { code: 'MPFI_DEF', label: 'Defusion',                            dimension: 'flexibility',   item_codes: ['MPFI_DEF_1','MPFI_DEF_2','MPFI_DEF_3','MPFI_DEF_4','MPFI_DEF_5'] },
    { code: 'MPFI_VAL', label: 'Values',                              dimension: 'flexibility',   item_codes: ['MPFI_VAL_1','MPFI_VAL_2','MPFI_VAL_3','MPFI_VAL_4','MPFI_VAL_5'] },
    { code: 'MPFI_CAC', label: 'Committed Action',                    dimension: 'flexibility',   item_codes: ['MPFI_CAC_1','MPFI_CAC_2','MPFI_CAC_3','MPFI_CAC_4','MPFI_CAC_5'] },
    { code: 'MPFI_EXA', label: 'Experiential Avoidance',              dimension: 'inflexibility', item_codes: ['MPFI_EXA_1','MPFI_EXA_2','MPFI_EXA_3','MPFI_EXA_4','MPFI_EXA_5'] },
    { code: 'MPFI_LPM', label: 'Lack of Present Moment Contact',      dimension: 'inflexibility', item_codes: ['MPFI_LPM_1','MPFI_LPM_2','MPFI_LPM_3','MPFI_LPM_4','MPFI_LPM_5'] },
    { code: 'MPFI_SCO', label: 'Self as Content',                     dimension: 'inflexibility', item_codes: ['MPFI_SCO_1','MPFI_SCO_2','MPFI_SCO_3','MPFI_SCO_4','MPFI_SCO_5'] },
    { code: 'MPFI_FUS', label: 'Fusion',                              dimension: 'inflexibility', item_codes: ['MPFI_FUS_1','MPFI_FUS_2','MPFI_FUS_3','MPFI_FUS_4','MPFI_FUS_5'] },
    { code: 'MPFI_LCV', label: 'Lack of Values Contact',              dimension: 'inflexibility', item_codes: ['MPFI_LCV_1','MPFI_LCV_2','MPFI_LCV_3','MPFI_LCV_4','MPFI_LCV_5'] },
    { code: 'MPFI_INA', label: 'Inaction',                            dimension: 'inflexibility', item_codes: ['MPFI_INA_1','MPFI_INA_2','MPFI_INA_3','MPFI_INA_4','MPFI_INA_5'] },
  ],
  // Items presented in paired subscale order (flexibility then matched inflexibility process)
  // to reduce response-set bias. Rolffs et al. recommend randomisation within administration.
  items: [
    // ── Acceptance (F) ───────────────────────────────────────────────────────
    { code: 'MPFI_ACC_1', display_order:  1, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was receptive to observing unpleasant thoughts and feelings without interfering with them.' },
    { code: 'MPFI_ACC_2', display_order:  2, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I tried to make peace with my negative thoughts and feelings rather than resisting them.' },
    { code: 'MPFI_ACC_3', display_order:  3, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I made room to fully experience negative thoughts and emotions, breathing them in rather than pushing them away.' },
    { code: 'MPFI_ACC_4', display_order:  4, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'When I had an upsetting thought or emotion, I tried to give it space rather than ignoring it.' },
    { code: 'MPFI_ACC_5', display_order:  5, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I opened myself to all of my feelings, the good and the bad.' },
    // ── Experiential Avoidance (I — reverse-scored for total) ─────────────────
    { code: 'MPFI_EXA_1', display_order:  6, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When I had a bad memory, I tried to distract myself to make it go away.' },
    { code: 'MPFI_EXA_2', display_order:  7, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I tried to distract myself when I felt unpleasant emotions.' },
    { code: 'MPFI_EXA_3', display_order:  8, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When unpleasant memories came to me, I tried to put them out of my mind.' },
    { code: 'MPFI_EXA_4', display_order:  9, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When something upsetting came up, I tried very hard to stop thinking about it.' },
    { code: 'MPFI_EXA_5', display_order: 10, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'If there was something I didn\'t want to think about, I would try many things to get it out of my mind.' },
    // ── Present Moment Awareness (F) ─────────────────────────────────────────
    { code: 'MPFI_PMA_1', display_order: 11, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was attentive and aware of my emotions.' },
    { code: 'MPFI_PMA_2', display_order: 12, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was in tune with my thoughts and feelings from moment to moment.' },
    { code: 'MPFI_PMA_3', display_order: 13, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I paid close attention to what I was thinking and feeling.' },
    { code: 'MPFI_PMA_4', display_order: 14, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was in touch with the ebb and flow of my thoughts and feelings.' },
    { code: 'MPFI_PMA_5', display_order: 15, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I strived to remain mindful and aware of my own thoughts and emotions.' },
    // ── Lack of Present Moment Contact (I — reverse-scored) ──────────────────
    { code: 'MPFI_LPM_1', display_order: 16, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I did most things on "automatic" with little awareness of what I was doing.' },
    { code: 'MPFI_LPM_2', display_order: 17, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I did most things mindlessly without paying much attention.' },
    { code: 'MPFI_LPM_3', display_order: 18, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I went through most days on auto-pilot without paying much attention to what I was thinking or feeling.' },
    { code: 'MPFI_LPM_4', display_order: 19, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I floated through most days without paying much attention.' },
    { code: 'MPFI_LPM_5', display_order: 20, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Most of the time I was just going through the motions without paying much attention.' },
    // ── Self as Context (F) ──────────────────────────────────────────────────
    { code: 'MPFI_SAC_1', display_order: 21, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'Even when I felt hurt or upset, I tried to maintain a broader perspective.' },
    { code: 'MPFI_SAC_2', display_order: 22, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I carried myself through tough moments by seeing my life from a larger viewpoint.' },
    { code: 'MPFI_SAC_3', display_order: 23, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I tried to keep perspective even when life knocked me down.' },
    { code: 'MPFI_SAC_4', display_order: 24, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'When I was scared or afraid, I still tried to see the larger picture.' },
    { code: 'MPFI_SAC_5', display_order: 25, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'When something painful happened, I tried to take a balanced view of the situation.' },
    // ── Self as Content (I — reverse-scored) ─────────────────────────────────
    { code: 'MPFI_SCO_1', display_order: 26, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I thought some of my emotions were bad or inappropriate and I shouldn\'t feel them.' },
    { code: 'MPFI_SCO_2', display_order: 27, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I criticized myself for having irrational or inappropriate emotions.' },
    { code: 'MPFI_SCO_3', display_order: 28, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I believed some of my thoughts are abnormal or bad and I shouldn\'t think that way.' },
    { code: 'MPFI_SCO_4', display_order: 29, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I told myself that I shouldn\'t be feeling the way I\'m feeling.' },
    { code: 'MPFI_SCO_5', display_order: 30, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I told myself I shouldn\'t be thinking the way I was thinking.' },
    // ── Defusion (F) ─────────────────────────────────────────────────────────
    { code: 'MPFI_DEF_1', display_order: 31, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was able to let negative feelings come and go without getting caught up in them.' },
    { code: 'MPFI_DEF_2', display_order: 32, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'When I was upset, I was able to let those negative feelings pass through me without clinging to them.' },
    { code: 'MPFI_DEF_3', display_order: 33, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'When I was scared or afraid, I was able to gently experience those feelings, allowing them to pass.' },
    { code: 'MPFI_DEF_4', display_order: 34, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was able to step back and notice negative thoughts and feelings without reacting to them.' },
    { code: 'MPFI_DEF_5', display_order: 35, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'In tough situations, I was able to notice my thoughts and feelings without getting overwhelmed by them.' },
    // ── Fusion (I — reverse-scored) ───────────────────────────────────────────
    { code: 'MPFI_FUS_1', display_order: 36, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Negative thoughts and feelings tended to stick with me for a long time.' },
    { code: 'MPFI_FUS_2', display_order: 37, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Distressing thoughts tended to spin around in my mind like a broken record.' },
    { code: 'MPFI_FUS_3', display_order: 38, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'It was very easy to get trapped into unwanted thoughts and feelings.' },
    { code: 'MPFI_FUS_4', display_order: 39, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When I had negative thoughts or feelings it was very hard to see past them.' },
    { code: 'MPFI_FUS_5', display_order: 40, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When something bad happened it was hard for me to stop thinking about it.' },
    // ── Values (F) ───────────────────────────────────────────────────────────
    { code: 'MPFI_VAL_1', display_order: 41, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I was very in-touch with what is important to me and my life.' },
    { code: 'MPFI_VAL_2', display_order: 42, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I stuck to my deeper priorities in life.' },
    { code: 'MPFI_VAL_3', display_order: 43, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I tried to connect with what is truly important to me on a daily basis.' },
    { code: 'MPFI_VAL_4', display_order: 44, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'Even when it meant making tough choices, I still tried to prioritize the things that were important to me.' },
    { code: 'MPFI_VAL_5', display_order: 45, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'My deeper values consistently gave direction to my life.' },
    // ── Lack of Values Contact (I — reverse-scored) ───────────────────────────
    { code: 'MPFI_LCV_1', display_order: 46, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'My priorities and values often fell by the wayside in my day to day life.' },
    { code: 'MPFI_LCV_2', display_order: 47, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When life got hectic, I often lost touch with the things I value.' },
    { code: 'MPFI_LCV_3', display_order: 48, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'The things that I value the most often fell off my priority list completely.' },
    { code: 'MPFI_LCV_4', display_order: 49, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'I didn\'t usually have time to focus on the things that are really important to me.' },
    { code: 'MPFI_LCV_5', display_order: 50, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'When times got tough, it was easy to forget about what I truly value.' },
    // ── Committed Action (F) ─────────────────────────────────────────────────
    { code: 'MPFI_CAC_1', display_order: 51, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'Even when I stumbled in my efforts, I didn\'t quit working toward what is important.' },
    { code: 'MPFI_CAC_2', display_order: 52, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'Even when times got tough, I was still able to take steps toward what I value in life.' },
    { code: 'MPFI_CAC_3', display_order: 53, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'Even when life got stressful and hectic, I still worked toward things that were important to me.' },
    { code: 'MPFI_CAC_4', display_order: 54, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I didn\'t let set-backs slow me down in taking action toward what I really want in life.' },
    { code: 'MPFI_CAC_5', display_order: 55, is_reverse_scored: false, is_clinical_flag_item: false,
      text: 'I didn\'t let my own fears and doubts get in the way of taking action toward my goals.' },
    // ── Inaction (I — reverse-scored) ────────────────────────────────────────
    { code: 'MPFI_INA_1', display_order: 56, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Negative feelings often trapped me in inaction.' },
    { code: 'MPFI_INA_2', display_order: 57, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Negative feelings easily stalled out my plans.' },
    { code: 'MPFI_INA_3', display_order: 58, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Getting upset left me stuck and inactive.' },
    { code: 'MPFI_INA_4', display_order: 59, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Negative experiences derailed me from what\'s really important.' },
    { code: 'MPFI_INA_5', display_order: 60, is_reverse_scored: true,  is_clinical_flag_item: false,
      text: 'Unpleasant thoughts and feelings easily overwhelmed my efforts to deepen my life.' },
  ],
  // Severity bands anchored to scale midpoint (sum 210 = mean 3.5).
  // No published universal cutoffs; interpret relative to sample norms
  // (Rolffs et al. 2018 provide subscale M/SD by gender).
  severity_bands: [
    { label: 'Low flexibility',      category: 'low',      min:  60, max: 150, color: '#E63946' },
    { label: 'Below average',        category: 'below_avg',min: 151, max: 210, color: '#E9C46A' },
    { label: 'Above average',        category: 'above_avg',min: 211, max: 270, color: '#90BE6D' },
    { label: 'High flexibility',     category: 'high',     min: 271, max: 360, color: '#52B788' },
  ],
}

export const BUILT_IN_SCALES: BuiltInScale[] = [PHQ9, GAD7, AAQ2, MPFI, EGA_CAREER, EGA_SCIENCE, EIA_HINDU_MUSLIM, EPA_INDIA]

export function getScaleByAbbreviation(abbreviation: string): BuiltInScale | null {
  return BUILT_IN_SCALES.find(s => s.abbreviation === abbreviation) ?? null
}

export function getSeverityBand(scale: BuiltInScale, score: number): SeverityBand | null {
  return scale.severity_bands.find(b => score >= b.min && score <= b.max) ?? null
}

export function getMaxItemScore(scale: BuiltInScale): number {
  return Math.max(...scale.response_options.map(o => o.value))
}
