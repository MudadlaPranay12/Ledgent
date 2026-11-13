// Bengali lexicon. Native words are transliterated by js/text.js at load time.
// Entries marked "unverified" were not checked with a native speaker.
export default {
  code: 'bn',
  name: 'বাংলা',
  tts: 'bn-IN',
  stt: 'bn-IN',
  direction: {
    credit: ['ধার', 'বাকি', 'dhar', 'baki'],
    payment: ['দিয়েছি', 'জমা', 'ফেরত', 'diyechi', 'joma', 'ferot'],
  },
  gave: ['দিয়েছি', 'দিয়েছে', 'diyechi', 'diyechhe'],
  took: ['নিয়েছি', 'niyechi'], // unverified
  past: ['দিয়েছি', 'হয়েছে', 'গেছে', 'এসেছে', 'diyechi', 'hoyechhe'],
  dates: {
    today: ['আজ', 'aaj'],
    yesterday: ['কাল', 'kaal'],
    dayBefore: ['পরশু', 'porshu'],
  },
  correction: ['না', 'ভুল', 'na', 'bhul'],
  confirm: ['হ্যাঁ', 'ঠিক', 'আচ্ছা', 'hyan', 'thik', 'achha'],
  cancel: ['বাতিল', 'থামো', 'batil', 'thamo'], // unverified
  negation: ['না', 'নেই', 'na', 'nei'],
  query: ['মোট', 'কত', 'হিসাব', 'mot', 'koto', 'hisab'],
  queryMax: ['সবচেয়ে', 'কাকে', 'shobcheye', 'kake'], // unverified
  fillers: ['টাকা', 'দাদা', 'taka', 'dada'],
  particles: ['এর', 'কে', 'থেকে', 'er', 'ke', 'theke'],
  labels: {},
};
