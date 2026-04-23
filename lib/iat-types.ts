// ─── IAT Type Registry ────────────────────────────────────────────────────────
//
// Each entry defines one IAT variant that can be added to a study.
// All variants share the same 7-block D2 algorithm (Greenwald et al. 2003).
// The only difference between types is the four word sets:
//   conceptA / conceptB — the "target" categories (e.g. Male vs Female)
//   attrA    / attrB    — the "attribute" categories (e.g. Career vs Family)
//
// Block structure (same for every type):
//   B1:  conceptA vs conceptB            (practice)
//   B2:  attrA vs attrB                  (practice)
//   B3:  conceptA+attrA vs conceptB+attrB (practice, scored by D2)
//   B4:  conceptA+attrA vs conceptB+attrB (test,     scored by D2)
//   B5:  conceptB vs conceptA            (practice — reversed, 20 trials Short-IAT)
//   B6:  conceptB+attrA vs conceptA+attrB (practice, scored by D2)
//   B7:  conceptB+attrA vs conceptA+attrB (test,     scored by D2)
//
// D-score sign convention (consistent across all types):
//   Positive D → faster when conceptA pairs with attrA → stronger conceptA–attrA association.
//   For Order B, the sign is flipped at scoring time so positive D keeps this meaning.
//
// Scientific basis notes are inline below each type.

export type WordCategory = 'conceptA' | 'conceptB' | 'attrA' | 'attrB'

export interface DInterpretation {
  label:    string
  detail:   string
  color:    string
  clinical: boolean   // true only for Death/Suicide IAT (triggers crisis-resources)
}

export interface IATTypeConfig {
  key:               string
  name:              string
  badge:             string          // short badge text e.g. "Stereotype"
  badgeColor:        string          // Tailwind-compatible hex or CSS colour
  description:       string
  citation:          string
  conceptALabel:     string          // e.g. "Male"
  conceptBLabel:     string          // e.g. "Female"
  attrALabel:        string          // e.g. "Career"
  attrBLabel:        string          // e.g. "Family"
  wordsConceptA:     string[]        // exactly 5 words
  wordsConceptB:     string[]        // exactly 5 words
  wordsAttrA:        string[]        // exactly 5 words
  wordsAttrB:        string[]        // exactly 5 words
  estimatedMinutes:  number
  clinicalNote:      string
  positiveD:         string          // one-line plain-English meaning of D > 0
  defaultDebriefNote: string         // shown to participant after task if no custom debrief
  interpretD:        (d: number) => DInterpretation
  dscore_bands: Array<{
    label: string; short: string
    min: number | null; max: number | null
    color: string; clinical: boolean
  }>
}

// ─── Shared attribute word sets ───────────────────────────────────────────────
// Confirmed from Project Implicit Race IAT dataset documentation and
// Greenwald, Nosek & Banaji 2003 JPSP methods section.
const PLEASANT = ['Joy', 'Happy', 'Laughter', 'Love', 'Wonderful']
const UNPLEASANT = ['Evil', 'Agony', 'Awful', 'Nasty', 'Horrible']

// ─── IAT Types ────────────────────────────────────────────────────────────────

const DEATH_SUICIDE: IATTypeConfig = {
  key:  'death_suicide',
  name: 'Death / Suicide IAT',
  badge: 'Clinical',
  badgeColor: '#E63946',
  description:
    'Measures implicit associations between self-concepts and death/life. '
    + 'Validated for suicide risk research.',
  citation:
    'Millner, A. J., et al. (2019). Implicit cognition and suicide. '
    + 'Current Opinion in Psychology, 22, 72–77. '
    + 'Greenwald, A. G., et al. (2003). JPSP, 85(2), 197–216.',
  conceptALabel: 'Self',
  conceptBLabel: 'Other',
  attrALabel:    'Death / Suicide',
  attrBLabel:    'Life',
  wordsConceptA: ['Me', 'My', 'I', 'Mine', 'Self'],
  wordsConceptB: ['They', 'Them', 'Their', 'Other', 'Theirs'],
  wordsAttrA:    ['Death', 'Die', 'Dying', 'Suicide', 'Dead'],
  wordsAttrB:    ['Life', 'Alive', 'Living', 'Survive', 'Thrive'],
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit self–death associations. '
    + 'This does not directly diagnose suicidal intent. '
    + 'Use alongside validated self-report measures.',
  positiveD: 'Stronger implicit association of Self with Death/Suicide',
  defaultDebriefNote:
    'The IAT measured the speed of associations between self-related words '
    + 'and death or life words. A result in any direction does not define you '
    + 'and is not a diagnosis. You are more than your reaction time.',
  interpretD(d) {
    if (d < 0)    return { label: 'Lean toward Life',              detail: 'Implicit associations lean toward life-related concepts when paired with self.',      color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'Little or no association',      detail: 'No clear implicit preference between Self–Death and Self–Life pairings.',             color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Self–Death association', detail: 'A slight implicit tendency to associate self-concepts with death/suicide.',            color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Self–Death',          detail: 'Moderately faster responses when self is paired with death/suicide concepts.',        color: '#F4A261', clinical: false }
    return               { label: 'Strong Self–Death ⚑',           detail: 'Strong implicit association between self and death/suicide. Consider clinical follow-up.', color: '#E63946', clinical: true  }
  },
  dscore_bands: [
    { label: 'Life association (D < 0)',           short: 'Life assoc.',    min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',     short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Self–Death (0.15 – 0.35)',    short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Self–Death (0.35 – 0.65)',  short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Self–Death (≥ 0.65)',         short: 'Strong ⚑',      min: 0.65, max: null, color: '#E63946', clinical: true  },
  ],
}

// Gender–Career IAT
// Word lists confirmed from Project Implicit and Greenwald (2003) JPSP.
// Career words: business, career, corporation, executive, management, office, professional, salary
// Family words: children, cousins, family, home, marriage, parents, relatives, wedding
// Male/Female names: standard Greenwald/Nosek validated name sets.
const GENDER_CAREER: IATTypeConfig = {
  key:  'gender_career',
  name: 'Gender–Career IAT',
  badge: 'Stereotype',
  badgeColor: '#457B9D',
  description:
    'Measures implicit associations between gender and career/family roles. '
    + 'Positive D = stronger Male–Career / Female–Family stereotyping.',
  citation:
    'Greenwald, A. G., et al. (2003). Understanding and using the IAT. JPSP, 85, 197–216. '
    + 'Nosek, B. A., et al. (2009). National differences in gender-science stereotypes. PNAS.',
  conceptALabel: 'Male',
  conceptBLabel: 'Female',
  attrALabel:    'Career',
  attrBLabel:    'Family',
  // Validated male names (Greenwald 1998 + Nosek 2009 sets)
  wordsConceptA: ['John', 'Paul', 'Mike', 'Kevin', 'James'],
  // Validated female names
  wordsConceptB: ['Amy', 'Joan', 'Lisa', 'Sarah', 'Diana'],
  // Career attribute words (confirmed from published IAT materials)
  wordsAttrA:    ['Career', 'Office', 'Salary', 'Executive', 'Management'],
  // Family attribute words (confirmed from published IAT materials)
  wordsAttrB:    ['Family', 'Home', 'Marriage', 'Children', 'Wedding'],
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit Male–Career associations, '
    + 'consistent with the documented gender–career stereotype. '
    + 'Results should be contextualised alongside explicit measures.',
  positiveD: 'Stronger implicit association of Male with Career (and Female with Family)',
  defaultDebriefNote:
    'This IAT measured automatic associations between gender and career or family roles. '
    + 'These associations are shaped by cultural exposure and do not reflect your conscious '
    + 'beliefs or values. Many people show gender–career associations even when they '
    + 'explicitly reject gender stereotypes.',
  interpretD(d) {
    if (d < 0)    return { label: 'Female–Career lean',       detail: 'Slightly faster when Female is paired with Career.',                    color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'Little or no association', detail: 'No clear implicit gender–career stereotype.',                            color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Male–Career',       detail: 'A slight implicit tendency to associate Male with Career roles.',        color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Male–Career',     detail: 'Moderately faster responses when Male is paired with Career.',          color: '#F4A261', clinical: false }
    return               { label: 'Strong Male–Career',       detail: 'Strong implicit association of Male with Career / Female with Family.',  color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Female–Career (D < 0)',              short: 'Female–Career', min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',     short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Male–Career (0.15 – 0.35)',   short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Male–Career (0.35 – 0.65)', short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Male–Career (≥ 0.65)',        short: 'Strong',        min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// Gender–Science IAT
// Word lists: Nosek, Banaji & Greenwald (2002) JPSP + Nosek et al. (2009) PNAS.
// Male/Female: pronouns (Man/Father/Husband → expanded to 5).
// Science: Physics, Chemistry, Biology, Math, Engineering.
// Liberal Arts: Poetry, Art, Dance, Literature, Philosophy.
const GENDER_SCIENCE: IATTypeConfig = {
  key:  'gender_science',
  name: 'Gender–Science IAT',
  badge: 'Stereotype',
  badgeColor: '#457B9D',
  description:
    'Measures implicit associations between gender and science/humanities disciplines. '
    + 'Positive D = stronger Male–Science stereotyping.',
  citation:
    'Nosek, B. A., Banaji, M. R., & Greenwald, A. G. (2002). Math = Male, Me = Female, '
    + 'therefore Math ≠ Me. JPSP, 83(1), 44–59. '
    + 'Nosek, B. A., et al. (2009). PNAS, 106(26), 10593–10597.',
  conceptALabel: 'Male',
  conceptBLabel: 'Female',
  attrALabel:    'Science',
  attrBLabel:    'Arts / Humanities',
  // Male and Female pronouns (Nosek 2002 uses Man, Father, Husband; extended to 5)
  wordsConceptA: ['Male', 'Man', 'Boy', 'He', 'His'],
  wordsConceptB: ['Female', 'Woman', 'Girl', 'She', 'Her'],
  // Science disciplines (confirmed from Nosek 2002 + 2009)
  wordsAttrA:    ['Physics', 'Chemistry', 'Biology', 'Math', 'Engineering'],
  // Liberal Arts (confirmed from Nosek 2002 + Greenwald 2003)
  wordsAttrB:    ['Poetry', 'Art', 'Dance', 'Literature', 'Philosophy'],
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score reflects stronger Male–Science associations, consistent '
    + 'with documented STEM gender stereotypes. Over 70% of respondents globally '
    + 'show some Male–Science lean (Nosek et al. 2009).',
  positiveD: 'Stronger implicit association of Male with Science (and Female with Arts)',
  defaultDebriefNote:
    'This IAT measured automatic associations between gender and academic disciplines. '
    + 'These associations reflect cultural exposure to STEM gender stereotypes — '
    + 'not your personal beliefs, values, or intellectual abilities.',
  interpretD(d) {
    if (d < 0)    return { label: 'Female–Science lean',      detail: 'Slightly faster when Female is paired with Science.',                     color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'Little or no association', detail: 'No clear implicit gender–science stereotype.',                             color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Male–Science',      detail: 'A slight implicit tendency to associate Male with Science disciplines.',   color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Male–Science',    detail: 'Moderately faster responses when Male is paired with Science.',           color: '#F4A261', clinical: false }
    return               { label: 'Strong Male–Science',      detail: 'Strong implicit association of Male with Science / Female with Arts.',     color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Female–Science (D < 0)',              short: 'Female–Science', min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',      short: 'No preference',  min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Male–Science (0.15 – 0.35)',   short: 'Slight',         min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Male–Science (0.35 – 0.65)', short: 'Moderate',       min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Male–Science (≥ 0.65)',        short: 'Strong',         min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// Gender–Valence IAT (Good/Bad)
// Measures evaluative implicit preference for one gender over the other.
// Attribute words: standard Project Implicit pleasant/unpleasant lists
// (confirmed from Race IAT dataset documentation).
const GENDER_VALENCE: IATTypeConfig = {
  key:  'gender_valence',
  name: 'Gender–Valence IAT',
  badge: 'Evaluative',
  badgeColor: '#6A4C93',
  description:
    'Measures implicit evaluative preference for male vs female concepts. '
    + 'Uses standard pleasant/unpleasant attribute words.',
  citation:
    'Greenwald, A. G., McGhee, D. E., & Schwartz, J. K. L. (1998). Measuring '
    + 'individual differences in implicit cognition: The IAT. JPSP, 74(6), 1464–1480.',
  conceptALabel: 'Male',
  conceptBLabel: 'Female',
  attrALabel:    'Good',
  attrBLabel:    'Bad',
  wordsConceptA: ['Male', 'Man', 'Boy', 'He', 'His'],
  wordsConceptB: ['Female', 'Woman', 'Girl', 'She', 'Her'],
  wordsAttrA:    PLEASANT,
  wordsAttrB:    UNPLEASANT,
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit Male–Good associations. '
    + 'This measures evaluative associations, not conscious attitudes.',
  positiveD: 'Stronger implicit association of Male with Good words',
  defaultDebriefNote:
    'This IAT measured automatic evaluative associations with gender concepts. '
    + 'These patterns are shaped by cultural exposure and media — '
    + 'not your conscious beliefs about men or women.',
  interpretD(d) {
    if (d < 0)    return { label: 'Female–Good lean',         detail: 'Slightly faster when Female is paired with pleasant words.',                   color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'Little or no preference',  detail: 'No clear implicit evaluative gender preference.',                               color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Male–Good',         detail: 'A slight implicit tendency to associate Male with pleasant words.',             color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Male–Good',       detail: 'Moderately faster responses when Male is paired with pleasant words.',         color: '#F4A261', clinical: false }
    return               { label: 'Strong Male–Good',         detail: 'Strong implicit association of Male with pleasant / Female with unpleasant.',   color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Female–Good (D < 0)',             short: 'Female–Good',   min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',  short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Male–Good (0.15 – 0.35)', short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Male–Good (0.35 – 0.65)', short: 'Moderate',    min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Male–Good (≥ 0.65)',       short: 'Strong',        min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// Hindu–Muslim IAT (India-specific)
// Names selected from published Indian implicit bias research (college-student samples).
// Attribute: standard pleasant/unpleasant (Greenwald 1998).
// Positive D = implicit preference for Hindu names over Muslim names.
const HINDU_MUSLIM: IATTypeConfig = {
  key:  'hindu_muslim',
  name: 'Hindu–Muslim IAT',
  badge: 'India',
  badgeColor: '#F4A261',
  description:
    'Measures implicit evaluative attitudes toward Hindu vs Muslim identity in India. '
    + 'Uses culturally validated Indian names as target stimuli.',
  citation:
    'Acharya, A., Blackwell, M., & Sen, M. (2016). Explaining Causal Findings Without Bias. '
    + 'APSR. Research literature on implicit religious attitudes in India (2015–2022).',
  conceptALabel: 'Hindu',
  conceptBLabel: 'Muslim',
  attrALabel:    'Good',
  attrBLabel:    'Bad',
  // Hindu names — common, unambiguously Hindu-associated names used in Indian bias research
  wordsConceptA: ['Ram', 'Mohan', 'Ravi', 'Sunita', 'Lakshmi'],
  // Muslim names — common, unambiguously Muslim-associated names used in Indian bias research
  wordsConceptB: ['Mohammad', 'Ali', 'Farida', 'Rashid', 'Fatima'],
  wordsAttrA:    PLEASANT,
  wordsAttrB:    UNPLEASANT,
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit Hindu–Good associations. '
    + 'This measures automatic attitudes shaped by cultural context — '
    + 'not conscious beliefs about either community.',
  positiveD: 'Stronger implicit positive association with Hindu names over Muslim names',
  defaultDebriefNote:
    'This IAT measured automatic associations between Hindu and Muslim names and '
    + 'pleasant or unpleasant words. These patterns reflect cultural exposure and '
    + 'historical context — not your conscious values or judgments about any community. '
    + 'Implicit attitudes can differ from explicitly held beliefs.',
  interpretD(d) {
    if (d < -0.15) return { label: 'Muslim–Good lean',          detail: 'Implicit positive associations lean toward Muslim names.',                 color: '#52B788', clinical: false }
    if (d < 0.15)  return { label: 'Little or no preference',   detail: 'No clear implicit preference between Hindu and Muslim names.',             color: '#888888', clinical: false }
    if (d < 0.35)  return { label: 'Slight Hindu–Good',         detail: 'Slight implicit positive association with Hindu names.',                   color: '#E9C46A', clinical: false }
    if (d < 0.65)  return { label: 'Moderate Hindu–Good',       detail: 'Moderate implicit positive association with Hindu over Muslim names.',     color: '#F4A261', clinical: false }
    return                { label: 'Strong Hindu–Good',         detail: 'Strong implicit positive association with Hindu names.',                   color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Muslim–Good (D < −0.15)',             short: 'Muslim–Good',   min: null,  max: -0.15, color: '#52B788', clinical: false },
    { label: 'Little or no preference (−0.15–0.15)', short: 'No preference', min: -0.15, max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Hindu–Good (0.15 – 0.35)',     short: 'Slight',        min: 0.15,  max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Hindu–Good (0.35 – 0.65)',   short: 'Moderate',      min: 0.35,  max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Hindu–Good (≥ 0.65)',          short: 'Strong',        min: 0.65,  max: null, color: '#E63946', clinical: false },
  ],
}

// Modi vs Other Prime Ministers IAT (India-specific)
// A political leader evaluation IAT — measures implicit evaluative preference
// for Modi vs other Indian Prime Ministers.
// Target stimuli: names closely associated with each political figure.
// Attribute: standard pleasant/unpleasant words.
// Positive D = implicit preference for Modi.
const MODI_PM: IATTypeConfig = {
  key:  'modi_pm',
  name: 'Modi vs Other PMs IAT',
  badge: 'India / Politics',
  badgeColor: '#2D6A4F',
  description:
    'Measures implicit evaluative attitudes toward Narendra Modi vs other Indian '
    + 'Prime Ministers. Novel political leader IAT following Project Implicit methodology.',
  citation:
    'Adapted from political leader IAT methodology (Greenwald et al. 1998, 2003). '
    + 'Stimuli selected to represent each Prime Minister without partisan framing.',
  conceptALabel: 'Modi',
  conceptBLabel: 'Other PMs',
  attrALabel:    'Good',
  attrBLabel:    'Bad',
  // Words closely associated with Modi — his name, first name, common abbreviation, associated terms
  wordsConceptA: ['Modi', 'Narendra', 'NaMo', 'Modiji', 'Gujarat'],
  // Other Prime Ministers — Nehru, Manmohan Singh, Vajpayee, Indira Gandhi, Rajiv Gandhi
  wordsConceptB: ['Nehru', 'Manmohan', 'Vajpayee', 'Indira', 'Rajiv'],
  wordsAttrA:    PLEASANT,
  wordsAttrB:    UNPLEASANT,
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit positive associations with Modi-related words. '
    + 'Political IATs measure automatic attitudes — not considered political opinions.',
  positiveD: 'Stronger implicit positive association with Modi vs other PMs',
  defaultDebriefNote:
    'This IAT measured automatic associations between names associated with Narendra Modi '
    + 'and other Indian Prime Ministers, paired with pleasant or unpleasant words. '
    + 'Your result reflects fast automatic patterns — not a measure of your political views '
    + 'or considered judgement about any political leader.',
  interpretD(d) {
    if (d < -0.15) return { label: 'Other PMs–Good lean',      detail: 'Implicit positive associations lean toward other Prime Ministers.',             color: '#52B788', clinical: false }
    if (d < 0.15)  return { label: 'Little or no preference',  detail: 'No clear implicit preference between Modi and other Prime Ministers.',           color: '#888888', clinical: false }
    if (d < 0.35)  return { label: 'Slight Modi–Good',         detail: 'Slight implicit positive association with Modi-related words.',                  color: '#E9C46A', clinical: false }
    if (d < 0.65)  return { label: 'Moderate Modi–Good',       detail: 'Moderate implicit positive associations with Modi over other PMs.',              color: '#F4A261', clinical: false }
    return                { label: 'Strong Modi–Good',         detail: 'Strong implicit positive association with Modi-related words.',                  color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Other PMs–Good (D < −0.15)',           short: 'Others–Good',   min: null,  max: -0.15, color: '#52B788', clinical: false },
    { label: 'Little or no preference (−0.15–0.15)', short: 'No preference', min: -0.15, max: 0.15,  color: '#888888', clinical: false },
    { label: 'Slight Modi–Good (0.15 – 0.35)',       short: 'Slight',        min: 0.15,  max: 0.35,  color: '#E9C46A', clinical: false },
    { label: 'Moderate Modi–Good (0.35 – 0.65)',     short: 'Moderate',      min: 0.35,  max: 0.65,  color: '#F4A261', clinical: false },
    { label: 'Strong Modi–Good (≥ 0.65)',            short: 'Strong',        min: 0.65,  max: null,  color: '#E63946', clinical: false },
  ],
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const IAT_TYPES: IATTypeConfig[] = [
  DEATH_SUICIDE,
  GENDER_CAREER,
  GENDER_SCIENCE,
  GENDER_VALENCE,
  HINDU_MUSLIM,
  MODI_PM,
]

export const IAT_TYPE_MAP: Record<string, IATTypeConfig> = Object.fromEntries(
  IAT_TYPES.map(t => [t.key, t]),
)

/** Fall back to Death/Suicide if an unknown key is stored in the DB. */
export function getIATType(key: string | null | undefined): IATTypeConfig {
  return IAT_TYPE_MAP[key ?? ''] ?? DEATH_SUICIDE
}

/** Helper: return the D-score band for a given value. */
export function bandForD(
  d: number,
  bands: IATTypeConfig['dscore_bands'],
) {
  for (const b of bands) {
    const aboveMin = b.min === null || d >= b.min
    const belowMax = b.max === null || d < b.max
    if (aboveMin && belowMax) return b
  }
  return bands[bands.length - 1]
}
