// Telugu lexicon. Native words are transliterated by js/text.js at load time.
// Entries marked "unverified" are my best reading and were not checked with a
// native speaker; treat them as data to correct rather than parser bugs.
export default {
  code: 'te',
  name: 'తెలుగు',
  tts: 'te-IN',
  stt: 'te-IN',
  direction: {
    credit: ['అప్పు', 'అప్పులు', 'రుణం', 'appu', 'runam'],
    payment: ['చెల్లించాను', 'ఇచ్చాను', 'తిరిగి', 'jama', 'చెల్లింపు'],
  },
  gave: ['ఇచ్చాను', 'ఇచ్చింది', 'ఇచ్చారు', 'icchanu', 'ichindi'],
  took: ['తీసుకున్నాను', 'tisukunnaanu'],
  past: ['ఇచ్చాను', 'అయింది', 'వెళ్ళింది', 'వచ్చింది', 'పాత', 'icchanu', 'ayindi'],
  dates: {
    today: ['ఈరోజు', 'నేడు', 'eeroju', 'nedu'],
    yesterday: ['నిన్న', 'ninna'],
    dayBefore: ['మొన్న', 'monna'],
  },
  correction: ['కాదు', 'తప్పు', 'సరిదిద్దు', 'kaadu', 'tappu'], // "సరిదిద్దు" (correct it) unverified
  confirm: ['అవును', 'సరే', 'ఒప్పు', 'avunu', 'sare', 'oppu'],
  cancel: ['వద్దు', 'ఆపు', 'vaddu', 'aapu'], // unverified
  negation: ['కాదు', 'లేదు', 'kaadu', 'ledu'],
  query: ['మొత్తం', 'ఎంత', 'లెక్క', 'mottam', 'entha', 'lekka'],
  // "migilindi" = "is remaining": often a balance statement, not a new entry.
  balance: ['మిగిలింది', 'మిగిలి', 'migilindi', 'migilindii', 'migili', 'బాకీ', 'baaki'],
  queryMax: ['ఎక్కువ', 'ఎవరు', 'ekkuva', 'evaru'], // unverified word order
  fillers: ['రూపాయలు', 'అండి', 'గారు', 'rupayalu', 'andi', 'garu'],
  particles: ['కి', 'కు', 'తో', 'నుంచి', 'ki', 'ku', 'to', 'nunchi'],
  labels: {},
};

