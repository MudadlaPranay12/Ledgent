// Tamil lexicon. Native words are transliterated by js/text.js at load time.
// Entries marked "unverified" were not checked with a native speaker.
export default {
  code: 'ta',
  name: 'தமிழ்',
  tts: 'ta-IN',
  stt: 'ta-IN',
  direction: {
    credit: ['கடன்', 'கடன்', 'kadan'],
    payment: ['கொடுத்தேன்', 'திரும்ப', 'செலுத்தியது', 'koduththeen', 'thirumba'],
  },
  gave: ['கொடுத்தேன்', 'கொடுத்தார்', 'koduththeen', 'koduthtar'],
  took: ['வாங்கினேன்', 'vaanginen'], // unverified
  past: ['கொடுத்தேன்', 'ஆனது', 'போனது', 'koduththeen', 'aanathu'],
  dates: {
    today: ['இன்று', 'indru'],
    yesterday: ['நேற்று', 'netru'],
    dayBefore: ['முன்தினம்', 'muntinam'], // unverified
  },
  correction: ['இல்லை', 'தப்பு', 'illai', 'tappu'],
  confirm: ['ஆம்', 'சரி', 'ஓகே', 'aam', 'sari', 'ok'],
  cancel: ['வேண்டாம்', 'நிறுத்து', 'vendaam', 'niruthu'], // unverified
  negation: ['இல்லை', 'illai'],
  query: ['மொத்தம்', 'எவ்வளவு', 'கணக்கு', 'mottam', 'evvalavu', 'kanakku'],
  queryMax: ['யாருக்கு', 'அதிகம்', 'yaarukku', 'athikam'], // unverified
  fillers: ['ரூபாய்', 'சார்', 'rupaai', 'saar'],
  particles: ['க்கு', 'இல்', 'இருந்து', 'ku', 'il', 'irunthu'],
  labels: {},
};
