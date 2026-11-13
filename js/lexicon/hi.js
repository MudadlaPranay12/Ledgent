// Hindi / Hinglish lexicon. Words may be native script or Roman; both are
// normalised through js/text.js so "उधार" and "udhaar" are the same entry.
export default {
  code: 'hi',
  name: 'हिंदी',
  tts: 'hi-IN',
  stt: 'hi-IN',
  direction: {
    credit: ['udhaar', 'udhar', 'udhari', 'udhaari', 'उधार', 'उधारी', 'baaki', 'baki', 'बाकी', 'bakaya', 'बकाया', 'likho', 'likh', 'likhna', 'लिखो', 'लिख', 'credit', 'khata', 'खाता'],
    payment: ['jama', 'jamaa', 'जमा', 'paid', 'payment', 'received', 'wapas', 'vapas', 'वापस', 'chukaya', 'chukaye', 'चुकाया', 'mila', 'mile', 'मिला', 'मिले', 'aaya', 'aaye', 'आया', 'आए'],
  },
  gave: ['diya', 'diye', 'de', 'dede', 'dedo', 'दिया', 'दिए', 'दे', 'देदो'],
  took: ['liya', 'liye', 'लिया', 'लिए'],
  past: ['tha', 'thi', 'the', 'था', 'थी', 'थे', 'diya', 'diye', 'दिया', 'दिए', 'gaya', 'gayi', 'gaye', 'गया', 'गई', 'गए', 'hua', 'hui', 'हुआ', 'हुई', 'aaya', 'aaye', 'आया', 'आए', 'mila', 'mile', 'मिला', 'मिले', 'liya', 'liye', 'लिया', 'लिए', 'paid', 'received', 'kharida', 'खरीदा'],
  dates: {
    today: ['aaj', 'आज', 'today'],
    yesterday: ['kal', 'कल', 'yesterday'],
    dayBefore: ['parso', 'parson', 'परसों'],
  },
  correction: ['nahi', 'nahin', 'नहीं', 'no', 'galat', 'गलत', 'wrong', 'matlab', 'मतलब', 'sorry', 'correction'],
  confirm: ['haan', 'han', 'haa', 'हाँ', 'हां', 'ha', 'yes', 'yeah', 'ok', 'okay', 'theek', 'thik', 'ठीक', 'sahi', 'सही', 'confirm', 'save', 'correct', 'bilkul', 'बिल्कुल', 'done', 'hmm'],
  cancel: ['cancel', 'ruko', 'rukiye', 'रुको', 'chhodo', 'छोड़ो', 'discard', 'band'],
  negation: ['nahi', 'nahin', 'नहीं', 'no'],
  query: ['total', 'टोटल', 'kitna', 'kitne', 'कितना', 'कितने', 'hisab', 'hisaab', 'हिसाब', 'balance', 'baaki', 'बाकी'],
  queryMax: ['sabse', 'zyada', 'ज्यादा', 'kiska', 'किसका', 'sabse zyada'],
  fillers: ['rupay', 'rupaye', 'rupees', 'rs', 'रुपये', 'रुपए', 'bhaiya', 'भैया', 'ji', 'जी', 'yaar', 'यार', 'arre', 'please', 'batao', 'बताओ'],
  particles: ['ka', 'ki', 'ke', 'ko', 'ne', 'se', 'का', 'की', 'के', 'को', 'ने', 'से'],
  labels: { sabzi: ['sabzi', 'सब्जी'], doodh: ['doodh', 'दूध'], atta: ['atta', 'आटा'], chakki: ['chakki', 'चक्की'] },
};
