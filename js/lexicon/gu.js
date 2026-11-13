// Gujarati lexicon. Native words are transliterated by js/text.js at load time.
// Entries marked "unverified" were not checked with a native speaker.
export default {
  code: 'gu',
  name: 'ગુજરાતી',
  tts: 'gu-IN',
  stt: 'gu-IN',
  direction: {
    credit: ['ઉધાર', 'બાકી', 'udhaar', 'baki'],
    payment: ['ચૂકવ્યું', 'જમા', 'પાછું', 'chukavyu', 'jama', 'pachhu'],
  },
  gave: ['આપ્યા', 'આપ્યું', 'aapya', 'aapyu'],
  took: ['લીધા', 'lidha'], // unverified
  past: ['આપ્યા', 'ગયા', 'આવ્યા', 'aapya', 'gaya', 'aavya'],
  dates: {
    today: ['આજે', 'aaje'],
    yesterday: ['કાલે', 'kaale'],
    dayBefore: ['પરમ દિવસે', 'param divase'], // unverified spelling
  },
  correction: ['ના', 'ખોટું', 'na', 'khotun'],
  confirm: ['હા', 'બરાબર', 'ઠીક', 'ha', 'barabar', 'thik'],
  cancel: ['રદ', 'થોભો', 'rad', 'thobho'], // unverified
  negation: ['ના', 'નથી', 'na', 'nathi'],
  query: ['કુલ', 'કેટલું', 'હિસાબ', 'kul', 'ketlu', 'hisab'],
  queryMax: ['સૌથી', 'કોના', 'sauthi', 'kona'], // unverified
  fillers: ['રૂપિયા', 'ભાઈ', 'rupiya', 'bhai'],
  particles: ['નો', 'ની', 'ને', 'થી', 'no', 'ni', 'ne', 'thi'],
  labels: {},
};
