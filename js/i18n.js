// Presentation strings for the eight target languages. Internal transaction
// values stay language-independent ('credit' | 'payment'); only what the
// shopkeeper sees and hears is translated here.
//
// Translations are written to be understood at a counter, not to be literary.
// Telugu/Tamil/Kannada/Malayalam/Bengali/Marathi wording was NOT checked by a
// native speaker in this build — see README limitations.

const HI = {
  credit: 'udhaar', payment: 'jama', balance: 'baaki', rupay: 'rupay',
  directionQ: 'Udhaar ya payment?',
  customerQ: 'Kiska hisab? Naam boliye ya Type dabaiye.',
  newCustomerQ: 'Naya customer {name} banaun?',
  dateQ: '{word} se matlab {date}? Ya aaj?',
  lowAmountQ: '{digits} — sahi?',
  balanceQ: '{name} ka total ₹{amount} baaki hai, ya ₹{amount} ka naya udhaar likhun?',
  unparsedQ: 'Suna: "{text}". Kaunsa customer, kitna, udhaar ya payment?',
  optBalance: 'Total baaki hai', optCredit: 'Naya udhaar', optPayment: 'Payment mila',
  optYes: 'Haan, sahi', optNo: 'Nahi', optNew: 'Haan, {name} banao',
  optAgain: 'Dobara boliye', optType: 'Type karein', optFirst: 'Pehla', optSecond: 'Dusra',
  readback: '{name}: {amount} rupay {type} — {when}.',
  readbackNoType: '{name}: {amount} rupay — udhaar ya payment?',
  readbackNew: 'Naya customer {name}: {amount} rupay?',
  saved: 'Bachaya gaya. {what}',
  savedShort: 'Saved', corrected: 'Sahi kar diya: {amount} rupay',
  whatSaved: '{name}: {amount} rupay {type}',
  cancelled: 'Cancelled', noDraft: 'Koi draft nahi', duplicate: 'Yeh entry pehle se saved thi',
  noCustomers: 'Koi customer nahi. Neeche se naam boliye.',
  newKhata: 'Naya khata — pehli entry boliye.',
  noEntriesToFix: 'Koi entry nahi hai jo sudhar sake',
  sealSummary: 'Din band. Aaj udhaar {credit} rupay, jama {payment} rupay.',
  ansTotal: '{name}{label} ka {amount} rupay baaki hai.',
  ansOverpaid: '{name}{label} ka {amount} rupay humne zyada le liya hai.',
  ansEven: '{name}{label} ka hisab barabar hai, kuch baaki nahi.',
  ansTodayCredit: 'Aaj {amount} rupay ka udhaar gaya.',
  ansTodayPayment: 'Aaj {amount} rupay aaya.',
  ansMax: 'Sabse zyada baaki {name} ka hai, {amount} rupay.',
  ansNoOne: 'Kisi ka bhi kuch baaki nahi hai.',
  ansUnknown: 'Yeh sawaal samajh nahi aaya.',
  stIdle: 'Listening · ready', stListen: 'Listening…', stThink: 'Thinking…',
  stNeeds: 'Needs confirmation', stSaved: 'Saved', stError: 'Error',
  stTranscript: 'Transcript mila — transaction clear nahi',
  hint: 'Dabaake boliye · hold anywhere', hold: 'Hold to talk', release: 'release = speech ends',
  confirm: 'Confirm · Haan', cancel: 'Cancel', type: 'Type', verify: 'Book verified',
  debugTxt: 'Debug', reminders: 'Reminders', aiBadge: 'AI',
  warnLang: 'Prisma ne {got} bheja, aapne {want} chuna',
  warnScript: 'Transcript is script me nahi hai',
  reminderLine: 'Namaste {name} ji, aapka Rs {amount} ka hisab baaki hai.',
  noSpeech: 'No speech heard', notAvailable: 'Voice not available in this browser',
};

const EN = {
  credit: 'credit', payment: 'payment', balance: 'balance', rupay: 'rupees',
  directionQ: 'Credit or payment?',
  customerQ: 'Whose account? Say the name or tap Type.',
  newCustomerQ: 'Create new customer {name}?',
  dateQ: 'Did you mean {date}? Or today?',
  lowAmountQ: '{digits} — correct?',
  balanceQ: '{name} has ₹{amount} pending — or is this ₹{amount} of new credit?',
  unparsedQ: 'Heard: "{text}". Who, how much, credit or payment?',
  optBalance: 'It is the balance', optCredit: 'New credit', optPayment: 'Payment received',
  optYes: 'Yes, correct', optNo: 'No', optNew: 'Yes, create {name}',
  optAgain: 'Say it again', optType: 'Type instead', optFirst: 'First', optSecond: 'Second',
  readback: '{name}: {amount} rupees {type} — {when}.',
  readbackNoType: '{name}: {amount} rupees — credit or payment?',
  readbackNew: 'New customer {name}: {amount} rupees?',
  saved: 'Saved. {what}',
  savedShort: 'Saved', corrected: 'Corrected to {amount} rupees',
  whatSaved: '{name}: {amount} rupees {type}',
  cancelled: 'Cancelled', noDraft: 'No draft open', duplicate: 'That entry was already saved',
  noCustomers: 'No customers yet. Say a name below.',
  newKhata: 'New khata — say the first entry.',
  noEntriesToFix: 'There is no entry to correct',
  sealSummary: 'Day closed. Credit {credit} rupees, payments {payment} rupees.',
  ansTotal: '{name}{label} has {amount} rupees pending.',
  ansOverpaid: '{name}{label} has {amount} rupees extra with us.',
  ansEven: '{name}{label} is settled, nothing pending.',
  ansTodayCredit: 'Today {amount} rupees of credit was given.',
  ansTodayPayment: 'Today {amount} rupees came in.',
  ansMax: 'The largest balance is {name}, {amount} rupees.',
  ansNoOne: 'Nothing is pending with anyone.',
  ansUnknown: 'I did not understand that question.',
  stIdle: 'Listening · ready', stListen: 'Listening…', stThink: 'Thinking…',
  stNeeds: 'Needs confirmation', stSaved: 'Saved', stError: 'Error',
  stTranscript: 'Transcript received — transaction unclear',
  hint: 'Hold anywhere and speak', hold: 'Hold to talk', release: 'release = speech ends',
  confirm: 'Confirm', cancel: 'Cancel', type: 'Type', verify: 'Book verified',
  debugTxt: 'Debug', reminders: 'Reminders', aiBadge: 'AI',
  warnLang: 'Prisma detected {got}, you selected {want}',
  warnScript: 'Transcript is not in the expected script',
  reminderLine: 'Hello {name}, your balance of Rs {amount} is pending.',
  noSpeech: 'No speech heard', notAvailable: 'Voice not available in this browser',
};

const TE = {
  credit: 'అప్పు', payment: 'చెల్లింపు', balance: 'బాకీ', rupay: 'రూపాయలు',
  directionQ: 'అప్పు, చెల్లింపా?',
  customerQ: 'ఎవరి లెక్క? పేరు చెప్పండి లేదా Type నొక్కండి.',
  newCustomerQ: 'కొత్త కస్టమర్ {name} చేయాలా?',
  dateQ: '{word} అంటే {date}? లేదా ఈరోజు?',
  lowAmountQ: '{digits} — సరేనా?',
  balanceQ: '{name} మొత్తం ₹{amount} బాకీ ఉందా, లేదా ₹{amount} కొత్త అప్పు రాయాలా?',
  unparsedQ: 'విన్నాను: "{text}". ఎవరు, ఎంత, అప్పు లేదా చెల్లింపు?',
  optBalance: 'మొత్తం బాకీ ఉంది', optCredit: 'కొత్త అప్పు', optPayment: 'చెల్లింపు వచ్చింది',
  optYes: 'అవును, సరే', optNo: 'కాదు', optNew: 'అవును, {name} చేయండి',
  optAgain: 'మళ్ళీ చెప్పండి', optType: 'Type చేయండి', optFirst: 'మొదటి', optSecond: 'రెండో',
  readback: '{name}: {amount} రూపాయల {type} — {when}.',
  readbackNoType: '{name}: {amount} రూపాయలు — అప్పు, చెల్లింపా?',
  readbackNew: 'కొత్త కస్టమర్ {name}: {amount} రూపాయలు?',
  saved: 'సేవ్ అయింది. {what}',
  savedShort: 'సేవ్ అయింది', corrected: 'సరిచేశాను: {amount} రూపాయలు',
  whatSaved: '{name}: {amount} రూపాయల {type}',
  cancelled: 'రద్దు అయింది', noDraft: 'డ్రాఫ్ట్ లేదు', duplicate: 'ఈ ఎంట్రీ ఇప్పటికే సేవ్ అయింది',
  noCustomers: 'కస్టమర్లు లేరు. కింద పేరు చెప్పండి.',
  newKhata: 'కొత్త ఖాతా — మొదటి ఎంట్రీ చెప్పండి.',
  noEntriesToFix: 'సరిచేయడానికి ఎంట్రీ లేదు',
  sealSummary: 'రోజు ముగిసింది. ఈరోజు అప్పు {credit} రూపాయలు, చెల్లింపు {payment} రూపాయలు.',
  ansTotal: '{name}{label} {amount} రూపాయలు బాకీ ఉంది.',
  ansOverpaid: '{name}{label} నుండి {amount} రూపాయలు ఎక్కువ తీసుకున్నాం.',
  ansEven: '{name}{label} లెక్క సరిగ్గా ఉంది, బాకీ లేదు.',
  ansTodayCredit: 'ఈరోజు {amount} రూపాయల అప్పు ఇచ్చారు.',
  ansTodayPayment: 'ఈరోజు {amount} రూపాయలు వచ్చాయి.',
  ansMax: 'అందరికంటే ఎక్కువ బాకీ {name} దగ్గర ఉంది, {amount} రూపాయలు.',
  ansNoOne: 'ఎవరికీ బాకీ లేదు.',
  ansUnknown: 'ఈ ప్రశ్న అర్థం కాలేదు.',
  stIdle: 'వినిపిస్తోంది · సిద్ధం', stListen: 'వినిపిస్తోంది…', stThink: 'ఆలోచిస్తోంది…',
  stNeeds: 'నిర్ధారణ కావాలి', stSaved: 'సేవ్ అయింది', stError: 'లోపం',
  stTranscript: 'ట్రాన్స్క్రిప్ట్ వచ్చింది — లావాదేవీ స్పష్టం లేదు',
  hint: 'నొక్కి పట్టుకుని మాట్లాడండి', hold: 'మాట్లాడటానికి పట్టుకోండి', release: 'వదిలితే మాట ముగుస్తుంది',
  confirm: 'నిర్ధారించు', cancel: 'రద్దు', type: 'టైప్', verify: 'పుస్తకం నిర్ధారించబడింది',
  debugTxt: 'డీబగ్', reminders: 'రిమైండర్లు', aiBadge: 'AI',
  warnLang: 'Prisma {got} గుర్తించింది, మీరు {want} ఎంచుకున్నారు',
  warnScript: 'ట్రాన్స్క్రిప్ట్ ఆశించిన లిపిలో లేదు',
  reminderLine: 'నమస్తే {name} గారు, మీ {amount} రూపాయల బాకీ ఉంది.',
  noSpeech: 'మాట వినిపించలేదు', notAvailable: 'ఈ బ్రౌజర్‌లో వాయిస్ లేదు',
};

const TA = {
  credit: 'கடன்', payment: 'பணம் செலுத்துதல்', balance: 'பாக்கி', rupay: 'ரூபாய்',
  directionQ: 'கடனா அல்லது பணம் செலுத்தியதா?',
  customerQ: 'யாருடைய கணக்கு? பெயர் சொல்லுங்கள் அல்லது Type அழுத்துங்கள்.',
  newCustomerQ: 'புதிய வாடிக்கையாளர் {name} உருவாக்கலாமா?',
  dateQ: '{word} என்றால் {date}? அல்லது இன்றா?',
  lowAmountQ: '{digits} — சரியா?',
  balanceQ: '{name} மொத்தம் ₹{amount} பாக்கி உள்ளதா, அல்லது ₹{amount} புதிய கடன் எழுதவா?',
  unparsedQ: 'கேட்டது: "{text}". யார், எவ்வளவு, கடனா அல்லது பணமா?',
  optBalance: 'மொத்தம் பாக்கி', optCredit: 'புதிய கடன்', optPayment: 'பணம் வந்தது',
  optYes: 'ஆம், சரி', optNo: 'இல்லை', optNew: 'ஆம், {name} உருவாக்கு',
  optAgain: 'மீண்டும் சொல்லுங்கள்', optType: 'Type செய்யுங்கள்', optFirst: 'முதல்', optSecond: 'இரண்டாவது',
  readback: '{name}: {amount} ரூபாய் {type} — {when}.',
  readbackNoType: '{name}: {amount} ரூபாய் — கடனா அல்லது பணமா?',
  readbackNew: 'புதிய வாடிக்கையாளர் {name}: {amount} ரூபாய்?',
  saved: 'சேமிக்கப்பட்டது. {what}',
  savedShort: 'சேமிக்கப்பட்டது', corrected: 'திருத்தப்பட்டது: {amount} ரூபாய்',
  whatSaved: '{name}: {amount} ரூபாய் {type}',
  cancelled: 'ரத்து செய்யப்பட்டது', noDraft: 'வரைவு இல்லை', duplicate: 'இந்த பதிவு ஏற்கனவே சேமிக்கப்பட்டது',
  noCustomers: 'வாடிக்கையாளர் இல்லை. கீழே பெயர் சொல்லுங்கள்.',
  newKhata: 'புதிய கணக்கு — முதல் பதிவை சொல்லுங்கள்.',
  noEntriesToFix: 'திருத்த பதிவு இல்லை',
  sealSummary: 'நாள் முடிந்தது. இன்று கடன் {credit} ரூபாய், பணம் {payment} ரூபாய்.',
  ansTotal: '{name}{label} {amount} ரூபாய் பாக்கி உள்ளது.',
  ansOverpaid: '{name}{label} இடமிருந்து {amount} ரூபாய் அதிகம் வாங்கியுள்ளோம்.',
  ansEven: '{name}{label} கணக்கு சரியாக உள்ளது, பாக்கி இல்லை.',
  ansTodayCredit: 'இன்று {amount} ரூபாய் கடன் கொடுத்தீர்கள்.',
  ansTodayPayment: 'இன்று {amount} ரூபாய் வந்தது.',
  ansMax: 'அதிக பாக்கி {name} விடம் உள்ளது, {amount} ரூபாய்.',
  ansNoOne: 'யாரிடமும் பாக்கி இல்லை.',
  ansUnknown: 'இந்த கேள்வி புரியவில்லை.',
  stIdle: 'கேட்கிறது · தயார்', stListen: 'கேட்கிறது…', stThink: 'யோசிக்கிறது…',
  stNeeds: 'உறுதி தேவை', stSaved: 'சேமிக்கப்பட்டது', stError: 'பிழை',
  stTranscript: 'உரை வந்தது — பரிவர்த்தனை தெளிவில்லை',
  hint: 'அழுத்திப் பிடித்து பேசுங்கள்', hold: 'பேச பிடித்திருக்கவும்', release: 'விட்டால் பேச்சு முடிகிறது',
  confirm: 'உறுதி செய்', cancel: 'ரத்து', type: 'தட்டச்சு', verify: 'புத்தகம் சரிபார்க்கப்பட்டது',
  debugTxt: 'பிழைத்திருத்தம்', reminders: 'நினைவூட்டல்', aiBadge: 'AI',
  warnLang: 'Prisma {got} எனக் கண்டறிந்தது, நீங்கள் {want} தேர்ந்தெடுத்தீர்கள்',
  warnScript: 'உரை எதிர்பார்த்த எழுத்தில் இல்லை',
  reminderLine: 'வணக்கம் {name}, உங்கள் {amount} ரூபாய் பாக்கி உள்ளது.',
  noSpeech: 'பேச்சு கேட்கவில்லை', notAvailable: 'இந்த உலாவியில் குரல் இல்லை',
};

const KN = {
  credit: 'ಸಾಲ', payment: 'ಪಾವತಿ', balance: 'ಬಾಕಿ', rupay: 'ರೂಪಾಯಿ',
  directionQ: 'ಸಾಲಾ ಅಥವಾ ಪಾವತಿಯಾ?',
  customerQ: 'ಯಾರ ಲೆಕ್ಕ? ಹೆಸರು ಹೇಳಿ ಅಥವಾ Type ಒತ್ತಿ.',
  newCustomerQ: 'ಹೊಸ ಗ್ರಾಹಕ {name} ಮಾಡಬೇಕೆ?',
  dateQ: '{word} ಎಂದರೆ {date}? ಅಥವಾ ಇಂದು?',
  lowAmountQ: '{digits} — ಸರಿನಾ?',
  balanceQ: '{name} ಒಟ್ಟು ₹{amount} ಬಾಕಿ ಇದೆಯಾ, ಅಥವಾ ₹{amount} ಹೊಸ ಸಾಲ ಬರೆಯಲಾ?',
  unparsedQ: 'ಕೇಳಿದ್ದು: "{text}". ಯಾರು, ಎಷ್ಟು, ಸಾಲ ಅಥವಾ ಪಾವತಿ?',
  optBalance: 'ಒಟ್ಟು ಬಾಕಿ ಇದೆ', optCredit: 'ಹೊಸ ಸಾಲ', optPayment: 'ಪಾವತಿ ಬಂದಿದೆ',
  optYes: 'ಹೌದು, ಸರಿ', optNo: 'ಇಲ್ಲ', optNew: 'ಹೌದು, {name} ಮಾಡು',
  optAgain: 'ಮತ್ತೆ ಹೇಳಿ', optType: 'Type ಮಾಡಿ', optFirst: 'ಮೊದಲನೇ', optSecond: 'ಎರಡನೇ',
  readback: '{name}: {amount} ರೂಪಾಯಿ {type} — {when}.',
  readbackNoType: '{name}: {amount} ರೂಪಾಯಿ — ಸಾಲಾ ಅಥವಾ ಪಾವತಿಯಾ?',
  readbackNew: 'ಹೊಸ ಗ್ರಾಹಕ {name}: {amount} ರೂಪಾಯಿ?',
  saved: 'ಉಳಿಸಲಾಗಿದೆ. {what}',
  savedShort: 'ಉಳಿಸಲಾಗಿದೆ', corrected: 'ಸರಿಪಡಿಸಲಾಗಿದೆ: {amount} ರೂಪಾಯಿ',
  whatSaved: '{name}: {amount} ರೂಪಾಯಿ {type}',
  cancelled: 'ರದ್ದುಮಾಡಲಾಗಿದೆ', noDraft: 'ಡ್ರಾಫ್ಟ್ ಇಲ್ಲ', duplicate: 'ಈ ನಮೂದು ಈಗಾಗಲೇ ಉಳಿಸಲಾಗಿದೆ',
  noCustomers: 'ಗ್ರಾಹಕರಿಲ್ಲ. ಕೆಳಗೆ ಹೆಸರು ಹೇಳಿ.',
  newKhata: 'ಹೊಸ ಖಾತೆ — ಮೊದಲ ನಮೂದು ಹೇಳಿ.',
  noEntriesToFix: 'ಸರಿಪಡಿಸಲು ನಮೂದು ಇಲ್ಲ',
  sealSummary: 'ದಿನ ಮುಗಿಯಿತು. ಇಂದು ಸಾಲ {credit} ರೂಪಾಯಿ, ಪಾವತಿ {payment} ರೂಪಾಯಿ.',
  ansTotal: '{name}{label} {amount} ರೂಪಾಯಿ ಬಾಕಿ ಇದೆ.',
  ansOverpaid: '{name}{label} ಬಳಿಯಿಂದ {amount} ರೂಪಾಯಿ ಹೆಚ್ಚು ತೆಗೆದುಕೊಂಡಿದ್ದೇವೆ.',
  ansEven: '{name}{label} ಲೆಕ್ಕ ಸರಿಯಾಗಿದೆ, ಬಾಕಿ ಇಲ್ಲ.',
  ansTodayCredit: 'ಇಂದು {amount} ರೂಪಾಯಿ ಸಾಲ ಕೊಟ್ಟಿದ್ದೀರಿ.',
  ansTodayPayment: 'ಇಂದು {amount} ರೂಪಾಯಿ ಬಂದಿದೆ.',
  ansMax: 'ಎಲ್ಲರಿಗಿಂತ ಹೆಚ್ಚು ಬಾಕಿ {name} ಬಳಿ ಇದೆ, {amount} ರೂಪಾಯಿ.',
  ansNoOne: 'ಯಾರಿಗೂ ಬಾಕಿ ಇಲ್ಲ.',
  ansUnknown: 'ಈ ಪ್ರಶ್ನೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.',
  stIdle: 'ಕೇಳುತ್ತಿದೆ · ಸಿದ್ಧ', stListen: 'ಕೇಳುತ್ತಿದೆ…', stThink: 'ಯೋಚಿಸುತ್ತಿದೆ…',
  stNeeds: 'ದೃಢೀಕರಣ ಬೇಕು', stSaved: 'ಉಳಿಸಲಾಗಿದೆ', stError: 'ದೋಷ',
  stTranscript: 'ಪಠ್ಯ ಬಂದಿದೆ — ವ್ಯವಹಾರ ಸ್ಪಷ್ಟವಿಲ್ಲ',
  hint: 'ಒತ್ತಿ ಹಿಡಿದು ಮಾತನಾಡಿ', hold: 'ಮಾತನಾಡಲು ಹಿಡಿಯಿರಿ', release: 'ಬಿಟ್ಟರೆ ಮಾತು ಮುಗಿಯುತ್ತದೆ',
  confirm: 'ದೃಢೀಕರಿಸು', cancel: 'ರದ್ದು', type: 'ಟೈಪ್', verify: 'ಪುಸ್ತಕ ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
  debugTxt: 'ಡೀಬಗ್', reminders: 'ಜ್ಞಾಪನೆ', aiBadge: 'AI',
  warnLang: 'Prisma {got} ಎಂದು ಗುರುತಿಸಿತು, ನೀವು {want} ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ',
  warnScript: 'ಪಠ್ಯ ನಿರೀಕ್ಷಿತ ಲಿಪಿಯಲ್ಲಿಲ್ಲ',
  reminderLine: 'ನಮಸ್ಕಾರ {name}, ನಿಮ್ಮ {amount} ರೂಪಾಯಿ ಬಾಕಿ ಇದೆ.',
  noSpeech: 'ಮಾತು ಕೇಳಲಿಲ್ಲ', notAvailable: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇಲ್ಲ',
};

const ML = {
  credit: 'കടം', payment: 'പണം നൽകി', balance: 'ബാക്കി', rupay: 'രൂപ',
  directionQ: 'കടമാണോ പണം നൽകിയതാണോ?',
  customerQ: 'ആരുടെ കണക്ക്? പേര് പറയൂ അല്ലെങ്കിൽ Type അമർത്തൂ.',
  newCustomerQ: 'പുതിയ കസ്റ്റമർ {name} ഉണ്ടാക്കണോ?',
  dateQ: '{word} എന്നാൽ {date}? അല്ലെങ്കിൽ ഇന്നോ?',
  lowAmountQ: '{digits} — ശരിയാണോ?',
  balanceQ: '{name} ആകെ ₹{amount} ബാക്കി ഉണ്ടോ, അതോ ₹{amount} പുതിയ കടം എഴുതണോ?',
  unparsedQ: 'കേട്ടത്: "{text}". ആര്, എത്ര, കടമോ പണമോ?',
  optBalance: 'ആകെ ബാക്കി ഉണ്ട്', optCredit: 'പുതിയ കടം', optPayment: 'പണം വന്നു',
  optYes: 'അതെ, ശരി', optNo: 'അല്ല', optNew: 'അതെ, {name} ഉണ്ടാക്കൂ',
  optAgain: 'വീണ്ടും പറയൂ', optType: 'Type ചെയ്യൂ', optFirst: 'ആദ്യത്തേത്', optSecond: 'രണ്ടാമത്തേത്',
  readback: '{name}: {amount} രൂപ {type} — {when}.',
  readbackNoType: '{name}: {amount} രൂപ — കടമോ പണമോ?',
  readbackNew: 'പുതിയ കസ്റ്റമർ {name}: {amount} രൂപ?',
  saved: 'സേവ് ചെയ്തു. {what}',
  savedShort: 'സേവ് ചെയ്തു', corrected: 'തിരുത്തി: {amount} രൂപ',
  whatSaved: '{name}: {amount} രൂപ {type}',
  cancelled: 'റദ്ദാക്കി', noDraft: 'ഡ്രാഫ്റ്റ് ഇല്ല', duplicate: 'ഈ എൻട്രി മുൻപേ സേവ് ചെയ്തതാണ്',
  noCustomers: 'കസ്റ്റമർ ഇല്ല. താഴെ പേര് പറയൂ.',
  newKhata: 'പുതിയ കണക്ക് — ആദ്യ എൻട്രി പറയൂ.',
  noEntriesToFix: 'തിരുത്താൻ എൻട്രി ഇല്ല',
  sealSummary: 'ദിവസം അവസാനിച്ചു. ഇന്ന് കടം {credit} രൂപ, പണം {payment} രൂപ.',
  ansTotal: '{name}{label} {amount} രൂപ ബാക്കി ഉണ്ട്.',
  ansOverpaid: '{name}{label} ൽ നിന്ന് {amount} രൂപ അധികം വാങ്ങി.',
  ansEven: '{name}{label} കണക്ക് ശരിയാണ്, ബാക്കി ഇല്ല.',
  ansTodayCredit: 'ഇന്ന് {amount} രൂപ കടം നൽകി.',
  ansTodayPayment: 'ഇന്ന് {amount} രൂപ വന്നു.',
  ansMax: 'ഏറ്റവും കൂടുതൽ ബാക്കി {name} ലാണ്, {amount} രൂപ.',
  ansNoOne: 'ആർക്കും ബാക്കി ഇല്ല.',
  ansUnknown: 'ഈ ചോദ്യം മനസ്സിലായില്ല.',
  stIdle: 'കേൾക്കുന്നു · തയ്യാർ', stListen: 'കേൾക്കുന്നു…', stThink: 'ആലോചിക്കുന്നു…',
  stNeeds: 'സ്ഥിരീകരണം വേണം', stSaved: 'സേവ് ചെയ്തു', stError: 'പിശക്',
  stTranscript: 'ട്രാൻസ്ക്രിപ്റ്റ് കിട്ടി — ഇടപാട് വ്യക്തമല്ല',
  hint: 'അമർത്തിപ്പിടിച്ച് സംസാരിക്കൂ', hold: 'സംസാരിക്കാൻ പിടിക്കൂ', release: 'വിട്ടാൽ സംസാരം തീരും',
  confirm: 'സ്ഥിരീകരിക്കൂ', cancel: 'റദ്ദാക്കൂ', type: 'ടൈപ്പ്', verify: 'പുസ്തകം പരിശോധിച്ചു',
  debugTxt: 'ഡീബഗ്', reminders: 'ഓർമ്മപ്പെടുത്തൽ', aiBadge: 'AI',
  warnLang: 'Prisma {got} കണ്ടെത്തി, നിങ്ങൾ {want} തിരഞ്ഞെടുത്തു',
  warnScript: 'ട്രാൻസ്ക്രിപ്റ്റ് പ്രതീക്ഷിച്ച ലിപിയിൽ അല്ല',
  reminderLine: 'നമസ്കാരം {name}, നിങ്ങളുടെ {amount} രൂപ ബാക്കി ഉണ്ട്.',
  noSpeech: 'സംസാരം കേട്ടില്ല', notAvailable: 'ഈ ബ്രൗസറിൽ ശബ്ദം ഇല്ല',
};

const BN = {
  credit: 'ধার', payment: 'জমা', balance: 'বাকি', rupay: 'টাকা',
  directionQ: 'ধার না জমা?',
  customerQ: 'কার হিসাব? নাম বলুন বা Type চাপুন।',
  newCustomerQ: 'নতুন কাস্টমার {name} তৈরি করব?',
  dateQ: '{word} মানে {date}? নাকি আজ?',
  lowAmountQ: '{digits} — ঠিক আছে?',
  balanceQ: '{name} মোট ₹{amount} বাকি আছে, নাকি ₹{amount} নতুন ধার লিখব?',
  unparsedQ: 'শুনলাম: "{text}". কে, কত, ধার না জমা?',
  optBalance: 'মোট বাকি আছে', optCredit: 'নতুন ধার', optPayment: 'জমা এসেছে',
  optYes: 'হ্যাঁ, ঠিক', optNo: 'না', optNew: 'হ্যাঁ, {name} তৈরি কর',
  optAgain: 'আবার বলুন', optType: 'Type করুন', optFirst: 'প্রথম', optSecond: 'দ্বিতীয়',
  readback: '{name}: {amount} টাকা {type} — {when}.',
  readbackNoType: '{name}: {amount} টাকা — ধার না জমা?',
  readbackNew: 'নতুন কাস্টমার {name}: {amount} টাকা?',
  saved: 'সেভ হয়েছে. {what}',
  savedShort: 'সেভ হয়েছে', corrected: 'সংশোধন: {amount} টাকা',
  whatSaved: '{name}: {amount} টাকা {type}',
  cancelled: 'বাতিল', noDraft: 'কোনো ড্রাফট নেই', duplicate: 'এই এন্ট্রি আগেই সেভ হয়েছে',
  noCustomers: 'কোনো কাস্টমার নেই। নিচে নাম বলুন।',
  newKhata: 'নতুন খাতা — প্রথম এন্ট্রি বলুন।',
  noEntriesToFix: 'সংশোধনের এন্ট্রি নেই',
  sealSummary: 'দিন শেষ। আজ ধার {credit} টাকা, জমা {payment} টাকা।',
  ansTotal: '{name}{label} {amount} টাকা বাকি আছে।',
  ansOverpaid: '{name}{label} থেকে {amount} টাকা বেশি নিয়েছি।',
  ansEven: '{name}{label} হিসাব সমান, বাকি নেই।',
  ansTodayCredit: 'আজ {amount} টাকা ধার দেওয়া হয়েছে।',
  ansTodayPayment: 'আজ {amount} টাকা এসেছে।',
  ansMax: 'সবচেয়ে বেশি বাকি {name} এর, {amount} টাকা।',
  ansNoOne: 'কারও বাকি নেই।',
  ansUnknown: 'এই প্রশ্নটা বুঝতে পারিনি।',
  stIdle: 'শুনছি · প্রস্তুত', stListen: 'শুনছি…', stThink: 'ভাবছি…',
  stNeeds: 'নিশ্চিতকরণ দরকার', stSaved: 'সেভ হয়েছে', stError: 'ত্রুটি',
  stTranscript: 'ট্রান্সক্রিপ্ট এসেছে — লেনদেন স্পষ্ট নয়',
  hint: 'চেপে ধরে বলুন', hold: 'বলার জন্য চেপে ধরুন', release: 'ছাড়লে কথা শেষ',
  confirm: 'নিশ্চিত করুন', cancel: 'বাতিল', type: 'টাইপ', verify: 'খাতা যাচাই হয়েছে',
  debugTxt: 'ডিবাগ', reminders: 'মনে করানো', aiBadge: 'AI',
  warnLang: 'Prisma {got} পেয়েছে, আপনি {want} বেছেছেন',
  warnScript: 'ট্রান্সক্রিপ্ট প্রত্যাশিত লিপিতে নেই',
  reminderLine: 'নমস্কার {name}, আপনার {amount} টাকা বাকি আছে।',
  noSpeech: 'কথা শোনা যায়নি', notAvailable: 'এই ব্রাউজারে ভয়েস নেই',
};

const MR = {
  credit: 'उधार', payment: 'जमा', balance: 'बाकी', rupay: 'रुपये',
  directionQ: 'उधार की जमा?',
  customerQ: 'कुणाचा हिशोब? नाव सांगा किंवा Type दाबा.',
  newCustomerQ: 'नवीन ग्राहक {name} करायचा?',
  dateQ: '{word} म्हणजे {date}? की आज?',
  lowAmountQ: '{digits} — बरोबर?',
  balanceQ: '{name} एकूण ₹{amount} बाकी आहे, की ₹{amount} नवीन उधार लिहू?',
  unparsedQ: 'ऐकले: "{text}". कोण, किती, उधार की जमा?',
  optBalance: 'एकूण बाकी आहे', optCredit: 'नवीन उधार', optPayment: 'जमा आली',
  optYes: 'हो, बरोबर', optNo: 'नाही', optNew: 'हो, {name} करा',
  optAgain: 'पुन्हा सांगा', optType: 'Type करा', optFirst: 'पहिला', optSecond: 'दुसरा',
  readback: '{name}: {amount} रुपये {type} — {when}.',
  readbackNoType: '{name}: {amount} रुपये — उधार की जमा?',
  readbackNew: 'नवीन ग्राहक {name}: {amount} रुपये?',
  saved: 'जतन झाले. {what}',
  savedShort: 'जतन झाले', corrected: 'दुरुस्त केले: {amount} रुपये',
  whatSaved: '{name}: {amount} रुपये {type}',
  cancelled: 'रद्द', noDraft: 'मसुदा नाही', duplicate: 'ही नोंद आधीच जतन आहे',
  noCustomers: 'ग्राहक नाहीत. खाली नाव सांगा.',
  newKhata: 'नवीन खाते — पहिली नोंद सांगा.',
  noEntriesToFix: 'दुरुस्त करण्यासाठी नोंद नाही',
  sealSummary: 'दिवस संपला. आज उधार {credit} रुपये, जमा {payment} रुपये.',
  ansTotal: '{name}{label} {amount} रुपये बाकी आहे.',
  ansOverpaid: '{name}{label} कडून {amount} रुपये जास्त घेतले आहेत.',
  ansEven: '{name}{label} हिशोब बरोबर आहे, बाकी नाही.',
  ansTodayCredit: 'आज {amount} रुपयांचा उधार दिला.',
  ansTodayPayment: 'आज {amount} रुपये आले.',
  ansMax: 'सर्वात जास्त बाकी {name} कडे आहे, {amount} रुपये.',
  ansNoOne: 'कोणाकडेही बाकी नाही.',
  ansUnknown: 'हा प्रश्न समजला नाही.',
  stIdle: 'ऐकत आहे · तयार', stListen: 'ऐकत आहे…', stThink: 'विचार करत आहे…',
  stNeeds: 'पुष्टी हवी', stSaved: 'जतन झाले', stError: 'त्रुटी',
  stTranscript: 'ट्रान्स्क्रिप्ट आले — व्यवहार स्पष्ट नाही',
  hint: 'दाबून धरा आणि बोला', hold: 'बोलण्यासाठी धरून ठेवा', release: 'सोडल्यावर बोलणे थांबते',
  confirm: 'पुष्टी करा', cancel: 'रद्द', type: 'टाइप', verify: 'वही तपासली',
  debugTxt: 'डीबग', reminders: 'आठवण', aiBadge: 'AI',
  warnLang: 'Prisma ने {got} ओळखले, तुम्ही {want} निवडले',
  warnScript: 'ट्रान्स्क्रिप्ट अपेक्षित लिपीत नाही',
  reminderLine: 'नमस्कार {name}, तुमचे {amount} रुपये बाकी आहेत.',
  noSpeech: 'बोलणे ऐकले नाही', notAvailable: 'या ब्राउझरमध्ये आवाज नाही',
};

const DICT = {
  'hi-IN': HI, 'en-IN': EN, 'te-IN': TE, 'ta-IN': TA,
  'kn-IN': KN, 'ml-IN': ML, 'bn-IN': BN, 'mr-IN': MR,
};

// Script each language is expected to be written in. Roman input is allowed for
// every language (code-mixing), so a mismatch is a warning, never a rejection.
const SCRIPTS = {
  'hi-IN': /[\u0900-\u097F]/,
  'mr-IN': /[\u0900-\u097F]/,
  'te-IN': /[\u0C00-\u0C7F]/,
  'ta-IN': /[\u0B80-\u0BFF]/,
  'kn-IN': /[\u0C80-\u0CFF]/,
  'ml-IN': /[\u0D00-\u0D7F]/,
  'bn-IN': /[\u0980-\u09FF]/,
  'en-IN': /[A-Za-z]/,
};

const ROMAN = /[A-Za-z]/;

export const UI_LANGS = Object.keys(DICT);

const OR = {
  'hi-IN': 'ya', 'en-IN': 'or', 'te-IN': 'లేదా', 'ta-IN': 'அல்லது',
  'kn-IN': 'ಅಥವಾ', 'ml-IN': 'അല്ലെങ്കിൽ', 'bn-IN': 'নাকি', 'mr-IN': 'की',
};
export const conjunction = (lang) => OR[lang] || 'or';

const TODAY = {
  'hi-IN': 'Aaj', 'en-IN': 'Today', 'te-IN': 'ఈరోజు', 'ta-IN': 'இன்று',
  'kn-IN': 'ಇಂದು', 'ml-IN': 'ഇന്ന്', 'bn-IN': 'আজ', 'mr-IN': 'आज',
};
export const todayWord = (lang) => TODAY[lang] || 'Today';

export function t(lang, key, vars = {}) {
  const dict = DICT[lang] || DICT['hi-IN'];
  let text = dict[key] ?? DICT['hi-IN'][key] ?? key;
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v ?? ''));
  return text;
}

/** Presentation label for an internal, language-independent transaction type. */
export function typeLabel(lang, type) {
  if (type === 'credit') return t(lang, 'credit');
  if (type === 'payment') return t(lang, 'payment');
  return `${t(lang, 'credit')}/${t(lang, 'payment')}?`;
}

export function hasExpectedScript(lang, text) {
  const rx = SCRIPTS[lang];
  if (!rx || !text) return true;
  return rx.test(text) || (lang !== 'en-IN' && ROMAN.test(text));
}

/** True when the transcript uses the language's own script (not just Roman). */
export function usesNativeScript(lang, text) {
  const rx = SCRIPTS[lang];
  if (!rx || !text) return false;
  return rx.test(text);
}

// Example chips shown under the notebook, in the active language.
export const EXAMPLES = {
  'hi-IN': ['Suresh ka 340 udhaar', 'Ramesh ka 150 udhaar', 'nahi, 430', 'Suresh ka total', 'din band'],
  'en-IN': ['Suresh 340 credit', 'Ramesh 150 credit', 'no, 430', 'Suresh total', 'close day'],
  'te-IN': ['సురేష్ కి 340 అప్పు', 'రమేష్ కి 150 అప్పు', 'కాదు, 430', 'సురేష్ మొత్తం', 'రోజు ముగించు'],
  'ta-IN': ['சுரேஷுக்கு 340 கடன்', 'ரமேஷுக்கு 150 கடன்', 'இல்லை, 430', 'சுரேஷ் மொத்தம்', 'நாள் முடி'],
  'kn-IN': ['ಸುರೇಶ್ ಗೆ 340 ಸಾಲ', 'ರಮೇಶ್ ಗೆ 150 ಸಾಲ', 'ಇಲ್ಲ, 430', 'ಸುರೇಶ್ ಒಟ್ಟು', 'ದಿನ ಮುಗಿಸು'],
  'ml-IN': ['സുരേഷിന് 340 കടം', 'രമേശിന് 150 കടം', 'അല്ല, 430', 'സുരേഷ് ആകെ', 'ദിവസം അവസാനിപ്പിക്കൂ'],
  'bn-IN': ['সুরেশের 340 ধার', 'রমেশের 150 ধার', 'না, 430', 'সুরেশের মোট', 'দিন শেষ'],
  'mr-IN': ['सुरेशला 340 उधार', 'रमेशला 150 उधार', 'नाही, 430', 'सुरेशचा एकूण', 'दिवस संपवा'],
};

export function scriptName(lang) {
  return {
    'hi-IN': 'Devanagari', 'mr-IN': 'Devanagari', 'en-IN': 'Latin',
    'te-IN': 'Telugu', 'ta-IN': 'Tamil', 'kn-IN': 'Kannada',
    'ml-IN': 'Malayalam', 'bn-IN': 'Bengali',
  }[lang] || 'unknown';
}
