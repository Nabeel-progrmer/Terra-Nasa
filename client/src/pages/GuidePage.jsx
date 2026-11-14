import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bot, Mic, Send, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const SUGGESTIONS = [
  { label: 'What does “significant” mean?', ur: 'اعداد و شمار میں “significant” کا کیا مطلب ہے؟', key: 'significance' },
  { label: 'Why can two places change differently?', ur: 'مختلف جگہوں پر تبدیلی مختلف کیوں ہوتی ہے؟', key: 'regional' },
  { label: 'What data does TERRA use?', ur: 'TERRA کون سا ڈیٹا استعمال کرتا ہے؟', key: 'sources' },
  { label: 'Is this an official emergency warning?', ur: 'کیا یہ سرکاری ہنگامی وارننگ ہے؟', key: 'warning' },
  { label: 'What should I do during an earthquake?', ur: 'زلزلے کے دوران مجھے کیا کرنا چاہیے؟', key: 'earthquake' },
  { label: 'What should I do during heavy rain or flooding?', ur: 'تیز بارش یا سیلاب میں کیا کرنا چاہیے؟', key: 'flood' },
];

const ANSWERS = {
  significance: {
    beginner: '“Statistically significant” means the pattern would be unusual under a no-trend assumption, using the test’s assumptions and a chosen 5% threshold. It does not mean the change is large, important to every person, or caused by one thing. TERRA also shows the size of the change and corrects for comparing several places.',
    researcher: 'TERRA reports a two-sided Mann–Kendall p-value and Benjamini–Hochberg q-value across selected locations; q < 0.05 is the app’s statistical flag. The Sen slope is the robust directional estimate. These are not causal claims; serial correlation and spatial dependence are not corrected, so inspect the time series, coverage, assumptions, and practical magnitude.',
    source: 'TERRA method notes', link: '/trend',
  },
  regional: {
    beginner: 'The same Earth system can behave differently in different places. Oceans, mountains, winds, land cover, and local weather patterns affect how a signal appears. Compare locations using the same variable and years, then look at each time series.',
    researcher: 'Regional heterogeneity can arise from spatially varying forcing, feedbacks, circulation, land-surface characteristics, and sampling. TERRA’s preset values are nearest NASA POWER MERRA‑2 grid points, not area-weighted region means; do not infer a regional mean from one point.',
    source: 'NASA POWER', link: '/trend',
  },
  sources: {
    beginner: 'TERRA labels the source beside each result. Climate trends use NASA POWER monthly MERRA‑2 reanalysis. Weather uses Open‑Meteo forecast output. Earthquake reports come from the USGS ComCat catalog. A forecast is a model estimate; it is not a direct observation or a guarantee.',
    researcher: 'The trend adapter aggregates NASA POWER monthly point values to day-weighted annual values and reports coverage, Theil–Sen slope, an approximate OLS interval, Mann–Kendall p, and BH q. Weather is Open‑Meteo model output. Earthquakes are USGS ComCat catalog events. Review provenance and method limitations before interpretation.',
    source: 'Data-source registry', link: '/sources',
  },
  warning: {
    beginner: 'No. A TERRA earthquake alert is a report of an earthquake already listed by USGS. A heavy-rain alert is based on forecast-model rainfall. Neither is an official local warning. Check your local emergency and weather authorities for instructions.',
    researcher: 'TERRA’s current alert rules are proximity/magnitude filters on USGS ComCat events and user-defined thresholds on Open‑Meteo hourly precipitation/probability. They are not calibrated impact forecasts, official CAP warnings, or early-warning systems. Verify against your jurisdiction’s authoritative warning service.',
    source: 'USGS ComCat and Open‑Meteo', link: '/alerts',
  },
  earthquake: {
    beginner: 'If shaking is happening: Drop to your hands and knees, cover your head and neck under sturdy furniture if possible, and hold on until it stops. Stay away from windows. After shaking, follow local emergency instructions and expect aftershocks.',
    researcher: 'During shaking, follow the official “Drop, Cover, and Hold On” guidance. Afterward, avoid damaged structures, anticipate aftershocks, and follow local emergency-management instructions. A catalog alert is not a prediction or a substitute for local public-safety alerts.',
    source: 'Ready.gov earthquake safety', external: 'https://www.ready.gov/earthquakes',
  },
  flood: {
    beginner: 'Move to higher ground if flooding is occurring or authorities tell you to evacuate. Never walk or drive through floodwater. Follow local emergency services. A rain forecast from TERRA is not a flood warning.',
    researcher: 'Heavy-precipitation forecasts do not establish flood onset or local impact. If flooding occurs, move to higher ground, avoid walking/driving through water, and follow official evacuation orders. Check the local hydrometeorological authority for warnings.',
    source: 'US National Weather Service flood safety', external: 'https://www.weather.gov/safety/flood',
  },
};

const URDU_ANSWERS = {
  significance: {
    beginner: '“اعداد و شمار کے لحاظ سے significant” کا مطلب ہے کہ کوئی رجحان، “کوئی رجحان نہیں” والی صورت میں، اس ٹیسٹ کی شرائط کے تحت غیر معمولی ہوگا۔ اس کا مطلب یہ نہیں کہ تبدیلی بڑی ہے، سب لوگوں کے لیے اہم ہے، یا کسی ایک وجہ سے ہوئی ہے۔ TERRA تبدیلی کی مقدار بھی دکھاتا ہے۔',
    researcher: 'TERRA دو طرفہ Mann–Kendall p-value اور منتخب مقامات پر Benjamini–Hochberg q-value دکھاتا ہے؛ q < 0.05 ایپ کا شماریاتی اشارہ ہے۔ Sen slope مضبوط رجحان کا اندازہ ہے۔ وقت کے ساتھ باہمی تعلق (serial correlation) اور مقامات کے باہمی انحصار کو درست نہیں کیا جاتا؛ اسے سبب یا حتمی ثبوت نہ سمجھیں۔',
  },
  regional: {
    beginner: 'زمین کے نظام ایک دوسرے سے جڑے ہیں، مگر ہر جگہ ایک جیسی نہیں۔ سمندر، پہاڑ، ہوائیں اور زمین کی سطح بدلتے ہیں کہ کوئی تبدیلی مقامی طور پر کیسے نظر آئے۔ ایک ہی پیمائش اور سال لے کر جگہوں کا موازنہ کریں۔',
    researcher: 'مقامی فرق مختلف forcing، feedback، circulation، land surface اور sampling سے پیدا ہو سکتے ہیں۔ TERRA کے مقامات NASA POWER MERRA‑2 کے قریب ترین grid points ہیں؛ یہ پورے خطے کی area-weighted اوسط نہیں ہیں۔',
  },
  sources: {
    beginner: 'TERRA ہر نتیجے کے ساتھ ماخذ دکھاتا ہے۔ رجحانات NASA POWER MERRA‑2 reanalysis سے، موسم Open‑Meteo forecast model سے، اور زلزلے USGS ComCat فہرست سے آتے ہیں۔ forecast ایک ماڈل کا اندازہ ہے، یقینی مشاہدہ نہیں۔',
    researcher: 'رجحان adapter NASA POWER کے ماہانہ point values کو دنوں کے وزن کے ساتھ سالانہ کرتا ہے اور coverage، Theil–Sen slope، اندازاً OLS interval، Mann–Kendall p اور BH q دیتا ہے۔ موسم Open‑Meteo model output، زلزلے USGS ComCat events ہیں۔ ہر inference سے پہلے provenance اور طریقۂ کار دیکھیں۔',
  },
  warning: {
    beginner: 'نہیں۔ TERRA کا زلزلہ alert، USGS کی فہرست میں درج ہو چکے زلزلے کی اطلاع ہے۔ بارش کا alert موسم کے ماڈل پر مبنی ہے۔ ان میں سے کوئی سرکاری مقامی ہنگامی warning یا زلزلے کی پیش گوئی نہیں۔ ہدایات کے لیے اپنے علاقے کے emergency ادارے سے رجوع کریں۔',
    researcher: 'TERRA کے موجودہ alert قواعد USGS ComCat event پر مقام/شدت کی حدیں اور Open‑Meteo hourly precipitation/probability کی صارف مقررہ حدیں لگاتے ہیں۔ یہ impact forecast، CAP سرکاری warning یا early-warning system نہیں۔ اپنے دائرۂ اختیار کے سرکاری نظام سے تصدیق کریں۔',
  },
  earthquake: {
    beginner: 'اگر زمین ہل رہی ہو: فوراً ہاتھوں اور گھٹنوں کے بل نیچے ہوں، ممکن ہو تو مضبوط میز کے نیچے سر اور گردن ڈھانپیں، اور جھٹکے رکنے تک پکڑے رہیں۔ کھڑکیوں سے دور رہیں۔ بعد میں مقامی ہنگامی ہدایات پر عمل کریں۔',
    researcher: 'زلزلے کے دوران سرکاری “Drop, Cover, and Hold On” رہنمائی پر عمل کریں۔ بعد میں نقصان زدہ عمارتوں سے دور رہیں، آفٹر شاکس کا امکان ذہن میں رکھیں، اور مقامی emergency management کی ہدایات پر عمل کریں۔ فہرست میں event آنا پیش گوئی نہیں ہے۔',
  },
  flood: {
    beginner: 'اگر سیلاب آ رہا ہو یا حکام کہیں تو اونچی جگہ پر جائیں۔ سیلابی پانی میں کبھی پیدل یا گاڑی سے داخل نہ ہوں۔ مقامی emergency ادارے کی ہدایات پر عمل کریں۔ TERRA کی بارش کی پیش گوئی سیلاب کی سرکاری warning نہیں۔',
    researcher: 'زیادہ بارش کی پیش گوئی اکیلے مقامی سیلاب یا اس کے اثرات ثابت نہیں کرتی۔ سیلاب کی صورت میں اونچی جگہ جائیں، پانی میں پیدل یا گاڑی سے نہ گزریں، اور سرکاری evacuation حکم پر عمل کریں۔ مقامی hydrometeorological authority کی warning دیکھیں۔',
  },
};

const ARABIC_ANSWERS = {
  significance: {
    beginner: 'تعني الدلالة الإحصائية أن النمط سيكون غير مألوف وفق فرضية عدم وجود اتجاه، وبناءً على افتراضات الاختبار وحدّ 5٪. ولا تعني أن التغيير كبير أو مهم للجميع أو ناتج عن سبب واحد. اعرض حجم التغيير وجودة البيانات قبل تفسير النتيجة.',
    researcher: 'يعرض TERRA قيمة p ثنائية الطرف لاختبار Mann–Kendall وقيمة q المصححة بطريقة Benjamini–Hochberg للمواقع المختارة؛ ويستخدم q < 0.05 كإشارة إحصائية. ميل Sen تقدير متين لاتجاه التغير. لا تُصحح النتائج للارتباط الزمني أو المكاني، ولا تثبت السببية.',
  },
  regional: {
    beginner: 'قد يتغير نظام الأرض نفسه بطرق مختلفة من مكان لآخر. تؤثر المحيطات والجبال والرياح والغطاء الأرضي والطقس المحلي في الإشارة المرصودة. قارن المواقع بالمتغير والسنوات نفسيهما، وافحص كل سلسلة زمنية.',
    researcher: 'قد ينتج عدم التجانس الإقليمي عن اختلاف التأثيرات والتغذيات الراجعة والدوران الجوي وخصائص سطح الأرض وأخذ العينات. نقاط TERRA هي أقرب خلايا شبكة NASA POWER MERRA‑2 وليست متوسطات مكانية مرجّحة للمناطق.',
  },
  sources: {
    beginner: 'يعرض TERRA مصدر البيانات بجانب كل نتيجة. تستخدم اتجاهات المناخ إعادة التحليل NASA POWER MERRA‑2، والطقس مخرجات نموذج Open‑Meteo، وتقارير الزلازل سجل USGS ComCat. التوقع تقدير نموذجي وليس مشاهدة مباشرة أو ضماناً.',
    researcher: 'يجمع موائم الاتجاهات القيم الشهرية النقطية من NASA POWER إلى قيم سنوية موزونة بالأيام، ويعرض التغطية وميل Theil–Sen وفترة OLS تقريبية وقيم Mann–Kendall p وBH q. راجع المصدر وقيود المنهج قبل التفسير.',
  },
  warning: {
    beginner: 'لا. تنبيه الزلزال من TERRA تقرير عن زلزال أدرجه USGS بالفعل. وتنبيه المطر الغزير مبني على توقع نموذجي. لا يمثّل أي منهما تحذيراً رسمياً محلياً. اتبع تعليمات سلطات الطوارئ والطقس المحلية.',
    researcher: 'تطبق قواعد التنبيه مرشحات القرب والمقدار على أحداث USGS ComCat وحدود المستخدم على هطول واحتمال Open‑Meteo بالساعة. ليست توقعات أثر مُعايرة أو تحذيرات CAP رسمية أو نظام إنذار مبكر. تحقّق من الجهة الرسمية المحلية.',
  },
  earthquake: {
    beginner: 'إذا بدأ الاهتزاز: انزل على يديك وركبتيك، واحمِ الرأس والرقبة تحت أثاث متين إن أمكن، وتمسّك به حتى يتوقف. ابتعد عن النوافذ. بعده اتبع تعليمات الطوارئ المحلية واستعد لهزات ارتدادية.',
    researcher: 'أثناء الاهتزاز اتبع إرشادات “انبطح، احتمِ، وتمسّك”. بعده ابتعد عن المباني المتضررة وتوقع هزات ارتدادية واتبع تعليمات إدارة الطوارئ المحلية. ظهور حدث في السجل ليس تنبؤاً ولا بديلاً عن تنبيهات السلامة الرسمية.',
  },
  flood: {
    beginner: 'انتقل إلى مكان مرتفع إذا وقع فيضان أو طلبت السلطات الإخلاء. لا تمشِ ولا تقد السيارة عبر مياه الفيضان. اتبع خدمات الطوارئ المحلية. توقع المطر من TERRA ليس تحذيراً من الفيضان.',
    researcher: 'لا تثبت توقعات الهطول الغزير بداية فيضان محلي أو أثره. عند حدوث الفيضان انتقل إلى مكان مرتفع، وتجنب عبور المياه مشياً أو بالسيارة، واتبع أوامر الإخلاء الرسمية. راجع هيئة الأرصاد والهيدرولوجيا المحلية.',
  },
};

function verifiedAnswer(key, audience, language, fallback) {
  if (language === 'ur-PK' && URDU_ANSWERS[key]?.[audience]) return URDU_ANSWERS[key][audience];
  if (language === 'ar' && ARABIC_ANSWERS[key]?.[audience]) return ARABIC_ANSWERS[key][audience];
  return fallback;
}

function localAnswer(question, audience) {
  const text = question.toLowerCase();
  if (/signific|p.?value|q.?value|trend test|aham|ahm|اعداد و شمار|اہم|معنی|有意|p値|q値|統計/.test(text)) return ANSWERS.significance[audience];
  if (/differ|region|place|opposite|same process|mukhtalif|jagah|مختلف|جگہوں|تبدیلی|地域|場所|違い|異なる/.test(text)) return ANSWERS.regional[audience];
  if (/data|source|nasa|usgs|open.?meteo|measurement|maakhaz|ڈیٹا|ماخذ|استعمال|データ|出典|情報源|観測/.test(text)) return ANSWERS.sources[audience];
  if (/official|warning|alert|predict|سرکاری|وارننگ|公式|警報|通知|予測/.test(text)) return ANSWERS.warning[audience];
  if (/earthquake|quake|shaking|zalzal|زلزل|地震/.test(text)) return ANSWERS.earthquake[audience];
  if (/rain|flood|storm|barish|sailab|بارش|سیلاب|雨|洪水|大雨/.test(text)) return ANSWERS.flood[audience];
  return null;
}

export default function GuidePage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const [audience, setAudience] = useState('beginner');
  const [language, setLanguage] = useState(locale);
  const [question, setQuestion] = useState('');
  const [contextType, setContextType] = useState('none');
  const [contextLatitude, setContextLatitude] = useState('');
  const [contextLongitude, setContextLongitude] = useState('');
  const [answer, setAnswer] = useState(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef(null);
  const config = useQuery({ queryKey: ['config-status'], queryFn: async () => { const response = await apiFetch('/api/config-status'); return response.json(); }, staleTime: 60000 });

  useEffect(() => setLanguage(locale), [locale]);
  const aiReady = Boolean(config.data?.config?.assistant?.configured);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  async function ask(text = question, topicKey = null) {
    const prompt = text.trim();
    if (!prompt) { inputRef.current?.focus(); return; }
    if (contextType === 'weather' && (!Number.isFinite(Number(contextLatitude)) || !Number.isFinite(Number(contextLongitude))
      || contextLatitude === '' || contextLongitude === ''
      || Number(contextLatitude) < -90 || Number(contextLatitude) > 90
      || Number(contextLongitude) < -180 || Number(contextLongitude) > 180)) {
      setStatus(t('Enter a valid latitude (−90 to 90) and longitude (−180 to 180) before asking with weather context.'));
      return;
    }
    setQuestion(prompt);
    setAnswer(null);
    setPending(true);
    setStatus(t('Finding a source-grounded explanation.'));
    const fallback = localAnswer(prompt, audience);
    const staticKey = topicKey || SUGGESTIONS.map((item) => item.key).find((item) => ANSWERS[item]?.[audience] === fallback);
    try {
      if (['warning', 'earthquake', 'flood'].includes(staticKey)) {
        setAnswer({ text: verifiedAnswer(staticKey, audience, language, fallback), source: ANSWERS[staticKey].source, link: ANSWERS[staticKey].link, external: ANSWERS[staticKey].external, ai: false });
      } else if (aiReady) {
        const response = await apiFetch('/api/guide/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: prompt,
            audience,
            language,
            context: contextType === 'weather'
              ? { type: 'weather', latitude: Number(contextLatitude), longitude: Number(contextLongitude) }
              : { type: contextType },
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'AI Guide unavailable.');
        setAnswer({ text: data.answer, source: 'AI-generated explanation; verify against primary sources.', link: '/sources', external: null, ai: true, context: data.context });
      } else if (fallback || staticKey) {
        setAnswer({ text: verifiedAnswer(staticKey, audience, language, fallback), source: staticKey ? ANSWERS[staticKey].source : 'TERRA verified guide', link: staticKey ? ANSWERS[staticKey].link : null, external: staticKey ? ANSWERS[staticKey].external : null, ai: false });
      } else {
        setAnswer({ text: t('I do not have a verified answer for that question yet. Try one of the suggested topics, or open the data-source and method pages. TERRA will not invent measurements or emergency instructions.'), source: 'TERRA verified guide', link: '/sources', ai: false });
      }
    setStatus(t('Explanation ready.'));
    } catch (error) {
      if (fallback || staticKey) {
        const verifiedText = verifiedAnswer(staticKey, audience, language, fallback);
        setAnswer({ text: verifiedText, source: staticKey ? ANSWERS[staticKey].source : 'TERRA verified guide', link: staticKey ? ANSWERS[staticKey].link : null, external: staticKey ? ANSWERS[staticKey].external : null, ai: false });
        setStatus(t('AI is unavailable, so TERRA is showing a reviewed guide answer.'));
      } else setStatus(t('AI Guide unavailable.'));
    } finally { setPending(false); }
  }

  function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { setStatus(t('Speech input is unavailable in this browser. Use a suggested question, keyboard, or device dictation.')); return; }
    const recognition = new Speech();
    recognition.lang = language === 'ur-PK' ? 'ur-PK' : language;
    recognition.onresult = (event) => { const text = event.results[0][0].transcript; setQuestion(text); setStatus(t('Voice input captured. Press Ask when ready.')); inputRef.current?.focus(); };
    recognition.onerror = () => setStatus(t('Speech input did not work. Your microphone audio is handled by the browser speech service; try device dictation or a suggestion.'));
    recognition.start();
    setStatus(t('Listening. Select the microphone only when you are ready to speak.'));
  }

  function speakAnswer() {
    if (!answer?.text || !window.speechSynthesis) { setStatus(t('Read-aloud is unavailable. The written answer remains available.')); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(answer.text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  }

  return <main className="page guide-page">
    <header className="page-header"><p className="eyebrow">{t('TERRA learning guide')}</p><h1>{t('Understand the Earth data')}</h1><p>{t('Choose the explanation style that works for you. Start with buttons—typing and sound are optional.')}</p></header>
    <section className="guide-control-row" aria-label={t('Guide preferences')}>
      <label>{t('Explanation style')}<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="beginner">{t('New to Earth science')}</option><option value="researcher">{t('Scientist or researcher')}</option></select></label>
      <label>{t('Answer language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}>{[['en-US', 'English'], ['ur-PK', 'Urdu']].map(([code, name]) => <option value={code} key={code}>{t(name)}</option>)}</select></label>
    </section>
    <p className={`guide-mode-status ${aiReady ? 'ai-ready' : ''}`} role="status"><Bot size={17} aria-hidden="true" />{aiReady ? t('Groq-powered guide is connected. Generated answers can still be wrong; check the cited source.') : t('Reviewed guide is ready. Groq is not configured on this server.')}</p>
    <p className="guide-privacy">{t('When Groq is configured, your question and any data context you choose are sent to Groq through TERRA’s server. Your API key stays on the server. By default, no live data or location is attached. If you choose weather context, the coordinates are sent to Open-Meteo and are included in the explanation request. Do not enter personal or confidential information. Speech entry is optional and may use your browser’s speech service.')}</p>
    <section className="guide-context" aria-labelledby="guide-context-title">
      <label id="guide-context-title" htmlFor="guide-context-type">{t('Optional live data context')}</label>
      <select id="guide-context-type" value={contextType} onChange={(event) => setContextType(event.target.value)} disabled={!aiReady}>
        <option value="none">{t('No live data (default)')}</option>
        <option value="weather">{t('Current weather at coordinates')}</option>
        <option value="space-weather">{t('NOAA space weather')}</option>
      </select>
      {contextType === 'weather' && <div className="guide-context-coordinates">
        <label htmlFor="guide-context-latitude">{t('Latitude')}<input id="guide-context-latitude" type="number" min="-90" max="90" step="any" value={contextLatitude} onChange={(event) => setContextLatitude(event.target.value)} required /></label>
        <label htmlFor="guide-context-longitude">{t('Longitude')}<input id="guide-context-longitude" type="number" min="-180" max="180" step="any" value={contextLongitude} onChange={(event) => setContextLongitude(event.target.value)} required /></label>
      </div>}
      <small>{t('Selected source readings, their valid times, and source links are attached to the request. AI explanations are not forecasts, diagnoses, or official warnings.')}</small>
    </section>
    <section className="guide-suggestions" aria-labelledby="guide-suggestions-title"><div className="section-heading"><div><p className="eyebrow small-eyebrow">{t('CHOOSE A TOPIC')}</p><h2 id="guide-suggestions-title">{t('What would you like explained?')}</h2></div></div><div className="guide-topic-grid">{SUGGESTIONS.map((item) => { const prompt = language === 'ur-PK' ? item.ur : t(item.label); return <button type="button" key={item.key} onClick={() => { setQuestion(prompt); void ask(prompt, item.key); }}>{prompt}</button>; })}</div></section>
    <section className="guide-ask" aria-label={t('Ask TERRA Guide')}><form onSubmit={(event) => { event.preventDefault(); void ask(); }}><label htmlFor="guide-question">{t('Your question')} <span>{t('(optional—topic buttons work without typing)')}</span></label><div className="guide-input-row"><input ref={inputRef} id="guide-question" maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('For example: what is a p-value?')} /><button type="button" className="secondary" onClick={startVoice} aria-label={t('Speak your question')}><Mic size={17} /> {t('Speak')}</button><button type="submit" className="primary" disabled={pending}><Send size={16} />{pending ? t('Thinking…') : t('Ask')}</button></div></form></section>
    {status && <p className="guide-status" role="status" aria-live="polite">{status}</p>}
    {answer && <article className="guide-answer" aria-labelledby="guide-answer-title"><div className="section-heading"><div><p className="eyebrow small-eyebrow">{answer.ai ? t('AI EXPLANATION') : t('TERRA VERIFIED GUIDE')}</p><h2 id="guide-answer-title">{t('Here is the explanation')}</h2></div><button type="button" className="secondary speak-answer" onClick={speakAnswer}><Volume2 size={16} /> {t('Read aloud')}</button></div><p>{answer.text}</p><small>{t('Reference:')} {answer.external ? <a href={answer.external} target="_blank" rel="noreferrer">{answer.source}</a> : answer.link ? <Link to={answer.link}>{answer.source}</Link> : answer.source}. {answer.ai && t('AI content is educational and is not a peer review or emergency service.')}</small>
      {answer.context && <div className="guide-context-citations"><strong>{t('Data attached to this explanation')}</strong><span>{answer.context.type} · {t('retrieved')} {new Date(answer.context.retrievedAt).toLocaleString(locale)}</span><ul>{answer.context.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name} <span>· {t('valid')} {source.validTime}</span></a></li>)}</ul></div>}
    </article>}
    <aside className="guide-footer-note"><BookOpen size={17} aria-hidden="true" /><p>{t('For a data-backed comparison,')} <Link to="/trend">{t('start a climate trend analysis')}</Link>. {t('To inspect provider records and assumptions, visit')} <Link to="/sources">{t('Data sources')}</Link>.</p></aside>
  </main>;
}
