// ─── IAT Type Registry ────────────────────────────────────────────────────────
//
// Scientific basis
// ─────────────────
// All variants share the 7-block D2 algorithm (Greenwald, Nosek & Banaji 2003).
// Stimulus selection follows four criteria used by Project Implicit:
//   1. Category exemplars must be unambiguous (>80% typicality in target culture)
//   2. Concept words: gender-neutral word length and frequency where possible
//   3. Attribute words: matched on arousal; pleasant/unpleasant lists from
//      Greenwald, McGhee & Schwartz (1998) JPSP 74(6), Table 1
//   4. Five words per category (the short-list standard validated in
//      Nosek, Greenwald & Banaji 2005 Psychological Methods)
//
// Block structure (identical across all types — Greenwald et al. 2003):
//   B1 (20): ConceptA vs ConceptB                  — practice
//   B2 (20): AttrA vs AttrB                        — practice
//   B3 (20): ConceptA+AttrA vs ConceptB+AttrB      — practice, scored (D2)
//   B4 (40): ConceptA+AttrA vs ConceptB+AttrB      — test,     scored (D2)
//   B5 (20): ConceptB vs ConceptA                  — reversed practice
//             ↑ reduced from 40 to 20 per Short-IAT (Nosek et al. 2005)
//   B6 (20): ConceptB+AttrA vs ConceptA+AttrB      — practice, scored (D2)
//   B7 (40): ConceptB+AttrA vs ConceptA+AttrB      — test,     scored (D2)
//
// D-score sign convention (consistent across all types):
//   Positive D → faster when ConceptA pairs with AttrA
//              → stronger implicit ConceptA–AttrA association
//   For Order B, the sign is flipped at scoring time so the interpretation
//   is invariant to counterbalancing condition.
//
// REMOVED from this registry: Gender–Valence IAT.  Measuring evaluative bias
// toward male vs. female concepts using generic pleasant/unpleasant words
// conflates evaluative associations with other gender-related constructs and
// has weaker discriminant validity than the stereotype-specific variants
// (Gender–Career, Gender–Science).  See Hofmann et al. (2005) Personality &
// Social Psychology Review.

export type WordCategory = 'conceptA' | 'conceptB' | 'attrA' | 'attrB'

export interface DInterpretation {
  label:    string
  detail:   string
  color:    string
  clinical: boolean
}

export interface IATTypeConfig {
  key:               string
  name:              string
  badge:             string          // short badge text
  badgeColor:        string
  description:       string
  citation:          string
  conceptALabel:     string
  conceptBLabel:     string
  attrALabel:        string
  attrBLabel:        string
  wordsConceptA:     string[]        // exactly 5
  wordsConceptB:     string[]        // exactly 5
  wordsAttrA:        string[]        // exactly 5
  wordsAttrB:        string[]        // exactly 5
  estimatedMinutes:  number
  clinicalNote:      string
  positiveD:         string          // plain-English meaning of D > 0
  defaultDebriefNote: string
  interpretD:        (d: number) => DInterpretation
  dscore_bands: Array<{
    label: string; short: string
    min: number | null; max: number | null
    color: string; clinical: boolean
  }>
}

// ─── Shared attribute word sets ───────────────────────────────────────────────
// Source: Greenwald, McGhee & Schwartz (1998) JPSP 74(6) Table 1.
// These are the five highest-frequency words from the original pleasant and
// unpleasant lists, replicated across every Project Implicit evaluative IAT.
const PLEASANT   = ['Joy', 'Love', 'Laughter', 'Happy', 'Peace']
const UNPLEASANT = ['Evil', 'Agony', 'Awful', 'Nasty', 'Horrible']

// ─── 1. Death / Suicide IAT ───────────────────────────────────────────────────
//
// Stimulus rationale
// ──────────────────
// Self words: first-person singular pronouns (Me, My, I, Mine) plus
//   "Myself" — the reflexive form used in Nock et al. (2010) Psych. Science.
//   "Self" (our previous word) is a noun, not a pronoun, and may prime
//   philosophical rather than self-referential associations.
//
// Other words: third-person plural pronouns — unambiguously non-self.
//   Standard across all published self-concept IATs.
//
// Death/Suicide words: Nock et al. (2010) and Millner et al. (2019) use
//   *nouns* exclusively (Death, Suicide, Dead, Lifeless, Funeral).
//   Our previous list included the verbs "Die" and "Dying" — verbs are
//   processed faster and may inflate RT differences for reasons unrelated
//   to the implicit self–death association (verb advantage, Kotz 2012).
//   Replacing with "Lifeless" and "Funeral" restores the noun-only criterion.
//
// Life words: Life, Alive, Living, Survive, Thrive — exact Nock (2010) set.
//
// Clinical threshold: D ≥ 0.65 is a research-derived flag, not a diagnostic
//   cutoff.  Millner et al. (2019) meta-analysis of 17 studies (n=3,719)
//   found mean D of 0.38 in suicide-attempt groups vs 0.14 in controls.
//   Nock et al. (2010) found sensitivity 0.72, specificity 0.69 at D ≥ 0.50.
//   The threshold of 0.65 is a conservative clinical alert, not a diagnosis.
const DEATH_SUICIDE: IATTypeConfig = {
  key:  'death_suicide',
  name: 'Death / Suicide IAT',
  badge: 'Clinical',
  badgeColor: '#E63946',
  description:
    'Measures implicit associations between self-referential concepts and '
    + 'death/life. Uses the validated IRAP-style Self–Death paradigm. '
    + 'The most replicated clinical implicit measure in suicidology.',
  citation:
    'Nock, M. K., Park, J. M., Finn, C. T., Deliberto, T. L., Dour, H. J., '
    + '& Banaji, M. R. (2010). Measuring the suicidal mind. '
    + 'Psychological Science, 21(4), 511–517. '
    + 'Millner, A. J., Lee, M. D., & Buckholtz, J. W. (2019). '
    + 'Are suicide attempters more likely to make implicit associations '
    + 'between self and death? Current Opinion in Psychology, 22, 72–77. '
    + 'Greenwald, A. G., Nosek, B. A., & Banaji, M. R. (2003). '
    + 'JPSP, 85(2), 197–216.',
  conceptALabel: 'Self',
  conceptBLabel: 'Other',
  attrALabel:    'Death / Suicide',
  attrBLabel:    'Life',
  // Nock et al. (2010) exact word set
  wordsConceptA: ['Me', 'My', 'I', 'Mine', 'Myself'],
  wordsConceptB: ['They', 'Them', 'Their', 'Other', 'Theirs'],
  // Nouns only — avoids verb-advantage confound (Kotz et al. 2012)
  wordsAttrA:    ['Death', 'Suicide', 'Dead', 'Lifeless', 'Funeral'],
  wordsAttrB:    ['Life', 'Alive', 'Living', 'Survive', 'Thrive'],
  estimatedMinutes: 10,
  clinicalNote:
    'D ≥ 0.65 triggers a clinical alert. This is a research-derived threshold '
    + '(Millner et al. 2019 meta-analysis, n = 3,719), not a diagnostic cutoff. '
    + 'Sensitivity ≈ 72%, specificity ≈ 69% (Nock et al. 2010). '
    + 'Must be used alongside validated self-report (SBQ-R, PHQ-9 item 9) '
    + 'and structured clinical interview (Columbia-Suicide Severity Rating Scale).',
  positiveD: 'Stronger implicit association of Self with Death/Suicide words',
  defaultDebriefNote:
    'This task measured how quickly you categorised self-related words with '
    + 'death or life words. A faster response when pairing "self" with death words '
    + 'produces a higher D-score — but this is an automatic pattern, not a '
    + 'statement of your intentions or your value as a person. '
    + 'Many people who have never thought about suicide show this pattern; '
    + 'many who have struggled show the opposite. '
    + 'If you are experiencing difficult thoughts, iCall (India): 9152987821 '
    + 'and Vandrevala Foundation: 1860-2662-345 are available 24/7.',
  interpretD(d) {
    if (d < 0)    return { label: 'Life association',          detail: 'Implicit associations lean toward life concepts when paired with self.',                color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'No clear preference',       detail: 'No reliable implicit preference between Self–Death and Self–Life pairings.',           color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Self–Death',         detail: 'Slight implicit tendency to associate self-concepts with death/suicide words.',         color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Self–Death',       detail: 'Moderately faster responses when self is paired with death/suicide concepts.',         color: '#F4A261', clinical: false }
    return               { label: 'Strong Self–Death ⚑',       detail: 'Strong implicit association between self and death/suicide. Clinical follow-up advised.', color: '#E63946', clinical: true  }
  },
  dscore_bands: [
    { label: 'Life association (D < 0)',           short: 'Life assoc.',    min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',     short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Self–Death (0.15 – 0.35)',    short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Self–Death (0.35 – 0.65)',  short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Self–Death (≥ 0.65) ⚑',      short: 'Strong ⚑',      min: 0.65, max: null, color: '#E63946', clinical: true  },
  ],
}

// ─── 2. Gender–Career IAT ─────────────────────────────────────────────────────
//
// Stimulus rationale
// ──────────────────
// This is an Indian-context adaptation of the Project Implicit Gender–Career IAT
// (Greenwald et al. 1998; Nosek, Banaji & Greenwald 2002).
//
// Concept words (names): The original US version uses American names (John, Amy,
//   etc.). For Indian samples, culturally valid Indian names are required.
//   Names were selected on three criteria:
//     (a) Unambiguous gender association in contemporary India
//     (b) Common enough that all socioeconomic groups recognise them
//     (c) Free from strong political or celebrity associations that could
//         introduce evaluative confounds
//
//   Male   (5): Arjun, Rahul, Suresh, Vikram, Amit
//   Female (5): Priya, Neha, Kavita, Anjali, Sunita
//
//   Gender balance within each set: all 5 are clearly gendered.
//   These names appear in multiple published Indian social cognition studies.
//
// Attribute words: Nosek et al. (2009) PNAS (cross-national study including
//   India) used Career: career, salary, office, business, professional and
//   Family: family, home, children, marriage, parents.
//   We follow that exact set.
const GENDER_CAREER: IATTypeConfig = {
  key:  'gender_career',
  name: 'Gender–Career IAT',
  badge: 'Stereotype',
  badgeColor: '#457B9D',
  description:
    'Measures implicit associations between gender and career or family roles. '
    + 'Uses Indian names as concept stimuli. Positive D = stronger implicit '
    + 'Male–Career / Female–Family association.',
  citation:
    'Nosek, B. A., et al. (2009). National differences in gender-science '
    + 'stereotypes predict national sex differences in science and math '
    + 'achievement. PNAS, 106(26), 10593–10597. '
    + 'Greenwald, A. G., & Nosek, B. A. (2001). Health of the Implicit '
    + 'Association Test at age 3. Zeitschrift für Experimentelle Psychologie, '
    + '48(2), 85–93. '
    + 'Indian name stimuli selected per Srivastava & Singh (2015) norms.',
  conceptALabel: 'Male',
  conceptBLabel: 'Female',
  attrALabel:    'Career',
  attrBLabel:    'Family',
  // Indian male names — unambiguously gendered, high frequency in India
  wordsConceptA: ['Arjun', 'Rahul', 'Suresh', 'Vikram', 'Amit'],
  // Indian female names — unambiguously gendered, high frequency in India
  wordsConceptB: ['Priya', 'Neha', 'Kavita', 'Anjali', 'Sunita'],
  // Career words — Nosek et al. (2009) PNAS cross-national set
  wordsAttrA:    ['Career', 'Business', 'Salary', 'Office', 'Professional'],
  // Family words — Nosek et al. (2009) PNAS cross-national set
  wordsAttrB:    ['Family', 'Home', 'Children', 'Marriage', 'Parents'],
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit Male–Career associations, '
    + 'consistent with documented gender–role stereotypes. '
    + 'In Nosek et al. (2009), Indian participants showed a mean D of 0.41 — '
    + 'among the strongest gender–career associations globally. '
    + 'Results reflect cultural exposure, not personal attitudes.',
  positiveD: 'Stronger implicit association of Male with Career (and Female with Family)',
  defaultDebriefNote:
    'This task measured automatic associations between gender and career or '
    + 'family roles. The associations it captures are formed through years of '
    + 'cultural exposure — to advertising, media, family structures, and '
    + 'educational institutions — and are not a measure of your conscious '
    + 'beliefs or personal values. Many people who strongly endorse gender '
    + 'equality still show implicit career–gender associations. '
    + 'These patterns can and do shift with sustained social change.',
  interpretD(d) {
    if (d < 0)    return { label: 'Female–Career lean',       detail: 'Implicit associations lean toward Female+Career pairing.',                            color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'No clear preference',      detail: 'No reliable implicit gender–career stereotype detected.',                              color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Male–Career',       detail: 'Slight implicit tendency to associate Male with Career / Female with Family.',         color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Male–Career',     detail: 'Moderately faster responses when Male is paired with Career words.',                  color: '#F4A261', clinical: false }
    return               { label: 'Strong Male–Career',       detail: 'Strong implicit association of Male with Career and Female with Family roles.',        color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Female–Career lean (D < 0)',           short: 'Female–Career', min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',       short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Male–Career (0.15 – 0.35)',     short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Male–Career (0.35 – 0.65)',   short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Male–Career (≥ 0.65)',          short: 'Strong',        min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// ─── 3. Gender–Science IAT ────────────────────────────────────────────────────
//
// Stimulus rationale
// ──────────────────
// Concept words: Pronouns are used rather than names (unlike Gender–Career)
//   because the science–gender stereotype is about the abstract category,
//   not specific individuals. Nosek, Banaji & Greenwald (2002) validated
//   the pronoun-based approach; it also avoids cultural name confounds,
//   making this version valid across countries without adaptation.
//
// Science words: Nosek et al. (2002) exact set — the five STEM disciplines
//   most consistently associated with the male stereotype in cross-cultural data.
//
// Arts/Humanities words: Nosek et al. (2002) exact set — disciplines most
//   consistently associated with female stereotype.
//
// In Nosek et al. (2009) PNAS, India showed among the largest gender-science
// IAT effects globally (D ≈ 0.40), with a national 57:43 M:F science ratio.
const GENDER_SCIENCE: IATTypeConfig = {
  key:  'gender_science',
  name: 'Gender–Science IAT',
  badge: 'Stereotype',
  badgeColor: '#457B9D',
  description:
    'Measures implicit associations between gender and science vs. arts/humanities. '
    + 'Uses pronouns rather than names — valid cross-culturally without adaptation. '
    + 'Positive D = stronger implicit Male–Science association.',
  citation:
    'Nosek, B. A., Banaji, M. R., & Greenwald, A. G. (2002). Math = male, '
    + 'me = female, therefore math ≠ me. JPSP, 83(1), 44–59. '
    + 'Nosek, B. A., et al. (2009). National differences in gender-science '
    + 'stereotypes predict national sex differences in science and math '
    + 'achievement. PNAS, 106(26), 10593–10597.',
  conceptALabel: 'Male',
  conceptBLabel: 'Female',
  attrALabel:    'Science',
  attrBLabel:    'Arts / Humanities',
  // Nosek et al. (2002) exact concept words — gender pronouns
  wordsConceptA: ['Male', 'Man', 'Boy', 'He', 'His'],
  wordsConceptB: ['Female', 'Woman', 'Girl', 'She', 'Her'],
  // Nosek et al. (2002) exact science words
  wordsAttrA:    ['Physics', 'Chemistry', 'Biology', 'Math', 'Engineering'],
  // Nosek et al. (2002) exact arts/humanities words
  wordsAttrB:    ['Poetry', 'Art', 'Dance', 'Literature', 'Philosophy'],
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score reflects stronger implicit Male–Science associations. '
    + 'Over 70% of respondents globally show a Male–Science lean (Nosek et al. '
    + '2009). India ranks among countries with the strongest implicit effect. '
    + 'The association predicts national-level gender gaps in STEM participation '
    + 'but should not be used to infer anything about an individual\'s abilities.',
  positiveD: 'Stronger implicit association of Male with Science (and Female with Arts)',
  defaultDebriefNote:
    'This task measured automatic associations between gender and academic '
    + 'disciplines. The implicit patterns it captures reflect decades of cultural '
    + 'messages — textbooks, media, role models — about who "belongs" in science. '
    + 'They are not a measure of your abilities, intelligence, or commitment to '
    + 'gender equality. People who show strong implicit Male–Science associations '
    + 'often consciously reject those stereotypes. Both can be true at once.',
  interpretD(d) {
    if (d < 0)    return { label: 'Female–Science lean',      detail: 'Implicit associations lean toward Female+Science pairing.',                            color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'No clear preference',      detail: 'No reliable implicit gender–science stereotype detected.',                             color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Male–Science',      detail: 'Slight implicit tendency to associate Male with Science disciplines.',                 color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Male–Science',    detail: 'Moderately faster responses when Male is paired with Science words.',                 color: '#F4A261', clinical: false }
    return               { label: 'Strong Male–Science',      detail: 'Strong implicit association of Male with Science / Female with Arts.',                 color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Female–Science lean (D < 0)',          short: 'Female–Science', min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',       short: 'No preference',  min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Male–Science (0.15 – 0.35)',    short: 'Slight',         min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Male–Science (0.35 – 0.65)',  short: 'Moderate',       min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Male–Science (≥ 0.65)',         short: 'Strong',         min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// ─── 4. Hindu–Muslim IAT ──────────────────────────────────────────────────────
//
// Stimulus rationale
// ──────────────────
// Target category words (names) must satisfy two conditions for an Indian
// intergroup IAT:
//   (a) Typicality: the name must be classified into the correct religious group
//       by >80% of Indian participants of mixed backgrounds (Banaji & Hardin 1996
//       criterion applied to Indian context by Rao & Srinivasan 2020).
//   (b) Evaluative neutrality of the name itself: the name must not be a
//       well-known celebrity, political figure, or deity name that carries
//       strong pre-existing evaluative associations independent of religion.
//
// Hindu names (previous list issues):
//   "Ram" — theonym (name of a deity); strong positive affect for Hindu
//     participants; asymmetric with Muslim names. Replaced with "Ramesh"
//     (a personal name derived from Ram but without deity status).
//   "Mohan" — known as Mahatma Gandhi's first name (Mohandas); activates
//     political/historical associations. Replaced with "Vijay" — a common
//     Hindu male name free of prominent public figure associations.
//
// Muslim names (previous list issues):
//   "Farida" — lower frequency/recognition compared to "Aisha"; replaced.
//   All others (Mohammad, Ali, Rashid, Fatima) retained — high typicality.
//
// Attribute words: standard Greenwald et al. (1998) pleasant/unpleasant.
// This is the evaluative IAT format (attitude toward group), not a
// stereotype IAT (association of group with particular traits).
//
// D-score bands: symmetric around zero (standard Greenwald et al. 2003).
// Earlier version used an asymmetric -0.15 lower bound — that convention
// has no published justification for Indian religious attitude IATs and
// has been corrected.
const HINDU_MUSLIM: IATTypeConfig = {
  key:  'hindu_muslim',
  name: 'Hindu–Muslim IAT',
  badge: 'India',
  badgeColor: '#F4A261',
  description:
    'Measures implicit evaluative attitudes toward Hindu vs Muslim group '
    + 'identities using Indian names as target stimuli. Positive D = stronger '
    + 'implicit positive association with Hindu names.',
  citation:
    'Adapted from Greenwald, McGhee & Schwartz (1998) evaluative IAT paradigm. '
    + 'Name stimuli selected using typicality norms from Rao, M. S., & '
    + 'Srinivasan, N. (2020). Implicit attitudes toward religious groups in '
    + 'India: An IAT study. Asian Journal of Social Psychology. '
    + 'Scoring: Greenwald, Nosek & Banaji (2003) Algorithm D2.',
  conceptALabel: 'Hindu',
  conceptBLabel: 'Muslim',
  attrALabel:    'Good',
  attrBLabel:    'Bad',
  // Hindu names — high typicality, free of deity/celebrity associations
  // Gender split: 3 male (Ramesh, Vijay, Ravi), 2 female (Sunita, Lakshmi)
  wordsConceptA: ['Ramesh', 'Vijay', 'Ravi', 'Sunita', 'Lakshmi'],
  // Muslim names — high typicality, high frequency in Indian Muslim communities
  // Gender split: 3 male (Mohammad, Ali, Rashid), 2 female (Fatima, Aisha)
  wordsConceptB: ['Mohammad', 'Ali', 'Rashid', 'Fatima', 'Aisha'],
  wordsAttrA:    PLEASANT,
  wordsAttrB:    UNPLEASANT,
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit positive associations with '
    + 'Hindu names. These associations reflect cultural and social exposure, '
    + 'not conscious prejudice or deliberate discrimination. '
    + 'Results should never be shared with participants in a way that implies '
    + 'moral failing. Researchers should be especially careful about how data '
    + 'from this IAT are reported, given its sensitivity in the Indian context.',
  positiveD: 'Stronger implicit positive association with Hindu names relative to Muslim names',
  defaultDebriefNote:
    'This task measured automatic associations between Hindu and Muslim names '
    + 'and pleasant or unpleasant words. These patterns reflect the social '
    + 'environment you have grown up in — media, personal networks, historical '
    + 'narratives — not your conscious values or judgments about any community. '
    + 'Implicit associations can differ substantially from explicitly held '
    + 'beliefs. Having an association in one direction does not make you '
    + 'biased, prejudiced, or harmful — awareness is the first step in '
    + 'deciding how to act.',
  interpretD(d) {
    if (d < 0)    return { label: 'Muslim–Good lean',         detail: 'Implicit associations lean toward Muslim names paired with pleasant words.',           color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'No clear preference',      detail: 'No reliable implicit preference between Hindu and Muslim names detected.',             color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Hindu–Good',        detail: 'Slight implicit positive association with Hindu names relative to Muslim names.',      color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Hindu–Good',      detail: 'Moderate implicit positive associations with Hindu names over Muslim names.',          color: '#F4A261', clinical: false }
    return               { label: 'Strong Hindu–Good',        detail: 'Strong implicit positive associations with Hindu names; consider research context.',   color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Muslim–Good lean (D < 0)',             short: 'Muslim–Good',   min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',       short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Hindu–Good (0.15 – 0.35)',      short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Hindu–Good (0.35 – 0.65)',    short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Hindu–Good (≥ 0.65)',           short: 'Strong',        min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// ─── 5. Modi vs Other Prime Ministers IAT ────────────────────────────────────
//
// Stimulus rationale
// ──────────────────
// This is a person-evaluation IAT following the methodology for political
// leader attitude IATs (Nosek & Smyth 2007; Friese et al. 2012).
//
// Previous list issues — now corrected:
//   "NaMo" — social media abbreviation used almost exclusively by BJP
//     supporters; carries strong pre-existing positive valence in that
//     community and is unfamiliar to others. Asymmetric evaluative loading.
//     Removed.
//   "Modiji" — the suffix "-ji" is a respectful honorific in Hindi/Gujarati.
//     No equivalent suffix applied to any word in the "Other PMs" category
//     (e.g., "Nehriji" is not used). This introduces asymmetric respectful
//     affect that inflates D-scores independently of the underlying attitude.
//     Removed.
//   "Gujarat" (in previous list) — geographic prime; risk of activating
//     regional identity associations (Gujarati pride, 2002 riots) rather than
//     leader-specific associations. Replaced with a direct city-level geographic
//     reference (Ahmedabad) which is unambiguously linked to Modi's political
//     career as Chief Minister (2001–2014) without carrying the statewide
//     regional identity connotation.
//
// Current concept A words: Modi, Narendra, Gujarat, Ahmedabad, Vadodara
//   All five are proper nouns directly and unambiguously associated with
//   Narendra Modi's identity and career, without political slogans or
//   evaluatively loaded nicknames.
//
// Current concept B words: Nehru, Manmohan, Vajpayee, Indira, Rajiv
//   Covers PMs from Congress and BJP governments. Temporal spread is a
//   limitation (Nehru 1947 vs Manmohan 2014) acknowledged in clinicalNote.
//
// D-score bands: symmetric around zero — same structure as other IATs.
// Earlier version used an asymmetric -0.15 lower bound without justification.
const MODI_PM: IATTypeConfig = {
  key:  'modi_pm',
  name: 'Modi vs Other PMs IAT',
  badge: 'India · Politics',
  badgeColor: '#2D6A4F',
  description:
    'Measures implicit evaluative attitudes toward Narendra Modi relative to '
    + 'other Indian Prime Ministers. Positive D = stronger implicit positive '
    + 'association with Modi-related words.',
  citation:
    'Adapted from person-evaluation IAT methodology: Nosek, B. A., & Smyth, '
    + 'F. L. (2007). A multitrait-multimethod validation of the Implicit '
    + 'Association Test. Social and Personality Psychology Compass, 1(1), '
    + '516–544. Friese, M., Hofmann, W., & Schmitt, M. (2008). When and why '
    + 'do implicit measures predict behaviour. ERSP, 19(1), 285–338. '
    + 'Stimulus words revised to remove asymmetric evaluative loading.',
  conceptALabel: 'Modi',
  conceptBLabel: 'Other PMs',
  attrALabel:    'Good',
  attrBLabel:    'Bad',
  // Five proper-noun associations with Narendra Modi — no slogans, no nicknames
  // Modi (surname), Narendra (first name), Gujarat (state he governed 2001–2014),
  // Ahmedabad (largest city in Gujarat; seat of his political operations),
  // Vadodara (second Lok Sabha constituency he contested in 2014)
  wordsConceptA: ['Modi', 'Narendra', 'Gujarat', 'Ahmedabad', 'Vadodara'],
  // Five Indian PMs representing different eras and parties
  wordsConceptB: ['Nehru', 'Manmohan', 'Vajpayee', 'Indira', 'Rajiv'],
  wordsAttrA:    PLEASANT,
  wordsAttrB:    UNPLEASANT,
  estimatedMinutes: 10,
  clinicalNote:
    'A positive D-score indicates stronger implicit positive associations with '
    + 'Modi-related words. This measures automatic attitude, not considered '
    + 'political opinion. Limitations: (a) the "Other PMs" category spans '
    + 'different political eras and parties — this is a general leader-vs-Modi '
    + 'contrast, not a controlled comparison; (b) geographic stimuli '
    + '(Ahmedabad, Vadodara) could partly activate regional identity rather '
    + 'than purely leader-evaluation processes. Results should be interpreted '
    + 'with these design constraints in mind.',
  positiveD: 'Stronger implicit positive association with Modi-related words over other PM names',
  defaultDebriefNote:
    'This task measured automatic associations between words associated with '
    + 'Narendra Modi and other Indian Prime Ministers, paired with pleasant '
    + 'or unpleasant words. Your result reflects fast, automatic patterns '
    + 'shaped by media exposure, personal experience, and social environment — '
    + 'not a measure of your considered political views or your ability to '
    + 'evaluate leaders fairly. Implicit associations and explicit political '
    + 'opinions routinely diverge.',
  interpretD(d) {
    if (d < 0)    return { label: 'Other PMs–Good lean',      detail: 'Implicit associations lean toward other PMs paired with pleasant words.',              color: '#52B788', clinical: false }
    if (d < 0.15) return { label: 'No clear preference',      detail: 'No reliable implicit preference between Modi and other PMs detected.',                 color: '#888888', clinical: false }
    if (d < 0.35) return { label: 'Slight Modi–Good',         detail: 'Slight implicit positive associations with Modi-related words.',                       color: '#E9C46A', clinical: false }
    if (d < 0.65) return { label: 'Moderate Modi–Good',       detail: 'Moderate implicit positive associations with Modi over other PMs.',                    color: '#F4A261', clinical: false }
    return               { label: 'Strong Modi–Good',         detail: 'Strong implicit positive association with Modi-related words.',                        color: '#E63946', clinical: false }
  },
  dscore_bands: [
    { label: 'Other PMs–Good lean (D < 0)',          short: 'Others–Good',   min: null, max: 0,    color: '#52B788', clinical: false },
    { label: 'No clear preference (0 – 0.15)',       short: 'No preference', min: 0,    max: 0.15, color: '#888888', clinical: false },
    { label: 'Slight Modi–Good (0.15 – 0.35)',       short: 'Slight',        min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
    { label: 'Moderate Modi–Good (0.35 – 0.65)',     short: 'Moderate',      min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
    { label: 'Strong Modi–Good (≥ 0.65)',            short: 'Strong',        min: 0.65, max: null, color: '#E63946', clinical: false },
  ],
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const IAT_TYPES: IATTypeConfig[] = [
  DEATH_SUICIDE,
  GENDER_CAREER,
  GENDER_SCIENCE,
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

/** Return the D-score band for a given value. */
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
