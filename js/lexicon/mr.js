// Marathi lexicon (Devanagari, some Roman). Entries marked "unverified" are
// best-effort and should be confirmed by a native speaker.
export default {
  code: 'mr',
  name: 'मराठी',
  tts: 'mr-IN',
  stt: 'mr-IN',
  direction: {
    credit: ['उधार', 'उसनवार', 'येणे', 'udhaar', 'usnavar'],
    payment: ['दिले', 'जमा', 'परत', 'dile', 'jama', 'parat'],
  },
  gave: ['दिले', 'दिली', 'देतो', 'dile', 'dili'],
  took: ['घेतले', 'ghetle'],
  past: ['होते', 'गेले', 'आले', 'दिले', 'hote', 'gele', 'aale', 'dile'],
  dates: {
    today: ['आज', 'aaj'],
    yesterday: ['काल', 'kaal'],
    dayBefore: ['परवा', 'parva'],
  },
  correction: ['नाही', 'चूक', 'बरोबर', 'nahi', 'chuk'], // "बरोबर" is confirm-side; kept for "नाही, बरोबर 430" unverified
  confirm: ['हो', 'बरं', 'बरोबर', 'ho', 'baran', 'barobar'],
  cancel: ['रद्द', 'थांबा', 'radda', 'thamba'], // unverified
  negation: ['नाही', 'nahi'],
  query: ['एकूण', 'किती', 'हिशोब', 'ekun', 'kiti', 'hishob'],
  queryMax: ['सर्वात', 'जास्त', 'कोणाकडे', 'sarvat', 'jast'], // unverified
  fillers: ['रुपये', 'भाऊ', 'rupaye', 'bhau'],
  particles: ['चा', 'ची', 'चे', 'ला', 'ने', 'कडून', 'cha', 'chi', 'che', 'la', 'ne'],
  labels: {},
};
