const WEATHER_CODES = new Map([
  [0, 'Clear sky'],
  [1, 'Mainly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Depositing rime fog'],
  [51, 'Light drizzle'],
  [53, 'Moderate drizzle'],
  [55, 'Dense drizzle'],
  [56, 'Light freezing drizzle'],
  [57, 'Dense freezing drizzle'],
  [61, 'Slight rain'],
  [63, 'Moderate rain'],
  [65, 'Heavy rain'],
  [66, 'Light freezing rain'],
  [67, 'Heavy freezing rain'],
  [71, 'Slight snow fall'],
  [73, 'Moderate snow fall'],
  [75, 'Heavy snow fall'],
  [77, 'Snow grains'],
  [80, 'Slight rain showers'],
  [81, 'Moderate rain showers'],
  [82, 'Violent rain showers'],
  [85, 'Slight snow showers'],
  [86, 'Heavy snow showers'],
  [95, 'Thunderstorm'],
  [96, 'Thunderstorm with slight hail'],
  [99, 'Thunderstorm with heavy hail'],
]);
const ARABIC_LABELS = {
  'Provider condition code': 'رمز الحالة لدى مزود البيانات',
  'Air temperature and comfort': 'درجة حرارة الهواء والإحساس الحراري',
  'Moisture in the air': 'الرطوبة في الهواء',
  'Clouds and sunlight': 'السحب وأشعة الشمس',
  Wind: 'الرياح',
  'Surface pressure': 'الضغط عند سطح الأرض',
};
const URDU_LABELS = {
  'Provider condition code': 'فراہم کنندہ کے موسم کا درجہ',
  'Air temperature and comfort': 'ہوا کا درجۂ حرارت اور محسوس ہونے والی کیفیت',
  'Moisture in the air': 'ہوا میں نمی',
  'Clouds and sunlight': 'بادل اور دھوپ',
  Wind: 'ہوا',
  'Surface pressure': 'سطح کا دباؤ',
};

function finite(value) {
  return value !== null
    && value !== undefined
    && String(value).trim() !== ''
    && Number.isFinite(Number(value));
}

function number(value, digits = 1) {
  return Number(value).toFixed(digits);
}

export function getWeatherDescription(code, locale = 'en-US') {
  if (!finite(code)) return null;
  const description = WEATHER_CODES.get(Number(code)) || null;
  if (!description || !['ar', 'ur-PK'].includes(locale)) return description;
  const translations = {
    'Clear sky': 'سماء صافية', 'Mainly clear': 'صحو غالباً', 'Partly cloudy': 'غائم جزئياً', 'Overcast': 'غائم كلياً',
    Fog: 'ضباب', 'Depositing rime fog': 'ضباب جليدي مترسّب', 'Light drizzle': 'رذاذ خفيف', 'Moderate drizzle': 'رذاذ متوسط', 'Dense drizzle': 'رذاذ كثيف',
    'Light freezing drizzle': 'رذاذ متجمد خفيف', 'Dense freezing drizzle': 'رذاذ متجمد كثيف', 'Slight rain': 'مطر خفيف', 'Moderate rain': 'مطر متوسط', 'Heavy rain': 'مطر غزير',
    'Light freezing rain': 'مطر متجمد خفيف', 'Heavy freezing rain': 'مطر متجمد غزير', 'Slight snow fall': 'تساقط ثلوج خفيف', 'Moderate snow fall': 'تساقط ثلوج متوسط', 'Heavy snow fall': 'تساقط ثلوج كثيف',
    'Snow grains': 'حبيبات ثلجية', 'Slight rain showers': 'زخات مطر خفيفة', 'Moderate rain showers': 'زخات مطر متوسطة', 'Violent rain showers': 'زخات مطر شديدة',
    'Slight snow showers': 'زخات ثلج خفيفة', 'Heavy snow showers': 'زخات ثلج كثيفة', Thunderstorm: 'عاصفة رعدية',
    'Thunderstorm with slight hail': 'عاصفة رعدية مع بَرَد خفيف', 'Thunderstorm with heavy hail': 'عاصفة رعدية مع بَرَد كثيف',
  };
  if (locale === 'ar') return translations[description] || description;
  const urdu = {
    'Clear sky': 'صاف آسمان', 'Mainly clear': 'زیادہ تر صاف', 'Partly cloudy': 'جزوی ابر آلود', 'Overcast': 'مکمل ابر آلود',
    Fog: 'دھند', 'Depositing rime fog': 'برفانی تہہ جمانے والی دھند', 'Light drizzle': 'ہلکی بوندا باندی', 'Moderate drizzle': 'درمیانی بوندا باندی', 'Dense drizzle': 'گھنی بوندا باندی',
    'Light freezing drizzle': 'ہلکی جمنے والی بوندا باندی', 'Dense freezing drizzle': 'گھنی جمنے والی بوندا باندی', 'Slight rain': 'ہلکی بارش', 'Moderate rain': 'درمیانی بارش', 'Heavy rain': 'تیز بارش',
    'Light freezing rain': 'ہلکی جمنے والی بارش', 'Heavy freezing rain': 'تیز جمنے والی بارش', 'Slight snow fall': 'ہلکی برف باری', 'Moderate snow fall': 'درمیانی برف باری', 'Heavy snow fall': 'شدید برف باری',
    'Snow grains': 'برف کے ذرات', 'Slight rain showers': 'ہلکی بارش کی پھوار', 'Moderate rain showers': 'درمیانی بارش کی پھوار', 'Violent rain showers': 'شدید بارش کی پھوار',
    'Slight snow showers': 'ہلکی برف کی پھوار', 'Heavy snow showers': 'شدید برف کی پھوار', Thunderstorm: 'گرج چمک کا طوفان',
    'Thunderstorm with slight hail': 'ہلکی ژالہ باری کے ساتھ گرج چمک', 'Thunderstorm with heavy hail': 'شدید ژالہ باری کے ساتھ گرج چمک',
  };
  return urdu[description] || description;
}

export function buildWeatherExplanation(current, units = {}, locale = 'en-US') {
  if (!current) return [];
  const explanations = [];
  const temperature = current.temperature_2m;
  const apparent = current.apparent_temperature;
  const humidity = current.relative_humidity_2m;
  const dewPoint = current.dew_point_2m;
  const isUrdu = locale === 'ur-PK';

  if (finite(current.weather_code)) {
    const description = getWeatherDescription(current.weather_code, locale);
    if (description) {
      explanations.push({
        label: isUrdu ? URDU_LABELS['Provider condition code'] : locale === 'ar' ? ARABIC_LABELS['Provider condition code'] : 'Provider condition code',
        text: isUrdu
          ? `فراہم کنندہ کے ماڈل نے موسم کی کیفیت ${description} (WMO code ${Number(current.weather_code)}) قرار دی ہے۔ یہ ماڈل کی درجہ بندی ہے، الگ sensor کا مشاہدہ نہیں۔`
          : locale === 'ar'
          ? `الحالة التي يصنفها نموذج مزود البيانات: ${description} (رمز المنظمة العالمية للأرصاد الجوية ${Number(current.weather_code)}). هذا تصنيف نموذجي وليس قراءة مستقلة من مستشعر.`
          : `${description} (WMO code ${Number(current.weather_code)}). This is the provider’s modelled condition category, not an independent sensor observation.`,
      });
    }
  }

  if (finite(temperature) && finite(apparent)) {
    const difference = Number(apparent) - Number(temperature);
    const direction = difference > 0 ? 'warmer' : difference < 0 ? 'cooler' : 'the same as';
    explanations.push({
      label: isUrdu ? URDU_LABELS['Air temperature and comfort'] : locale === 'ar' ? ARABIC_LABELS['Air temperature and comfort'] : 'Air temperature and comfort',
      text: isUrdu
        ? `ہوا کا درجۂ حرارت ${number(temperature)} ${units.temperature_2m || '°C'} ہے؛ محسوس ہونے والا درجۂ حرارت ${number(apparent)} ${units.apparent_temperature || '°C'} ہے (فرق ${number(Math.abs(difference))}°، ${difference > 0 ? 'زیادہ گرم' : difference < 0 ? 'زیادہ ٹھنڈا' : 'برابر'}). محسوس ہونے والی کیفیت درجۂ حرارت، ہوا، نمی اور شمسی تابکاری پر مبنی تخمینہ ہے؛ یہ دوسرے thermometer کی reading نہیں۔`
        : locale === 'ar'
        ? `درجة حرارة الهواء ${number(temperature)} ${units.temperature_2m || '°م'}؛ ودرجة الحرارة المحسوسة ${number(apparent)} ${units.apparent_temperature || '°م'} (الفرق ${number(Math.abs(difference))}°، ${difference > 0 ? 'أدفأ' : difference < 0 ? 'أبرد' : 'مساوية'}). الدرجة المحسوسة تقدير للراحة يجمع الحرارة والرياح والرطوبة والإشعاع الشمسي، وليست قراءة مقياس حرارة ثانٍ.`
        : `Air temperature is ${number(temperature)} ${units.temperature_2m || '°C'}; the provider’s apparent temperature is ${number(apparent)} ${units.apparent_temperature || '°C'} (${number(Math.abs(difference))}° ${direction}). Open-Meteo describes apparent temperature as a perceived-comfort estimate combining temperature, wind chill, relative humidity, and solar radiation; it is not a second thermometer reading.`,
    });
  }

  if (finite(temperature) && finite(dewPoint)) {
    const spread = Number(temperature) - Number(dewPoint);
    explanations.push({
      label: isUrdu ? URDU_LABELS['Moisture in the air'] : locale === 'ar' ? ARABIC_LABELS['Moisture in the air'] : 'Moisture in the air',
      text: isUrdu
        ? `ہوا کے درجۂ حرارت اور نقطۂ شبنم کا فرق ${number(spread)} ${units.temperature_2m || '°C'} ہے (${number(temperature)} − ${number(dewPoint)}). فرق کم ہو تو ہوا نمی سے سیر ہونے کے قریب ہوتی ہے؛ یہ نمی کی کیفیت بتاتا ہے، اکیلے بارش کی پیش گوئی نہیں۔`
        : locale === 'ar'
        ? `الفرق بين حرارة الهواء ونقطة الندى ${number(spread)} ${units.temperature_2m || '°م'} (${number(temperature)} − ${number(dewPoint)}). كلما صغر هذا الفرق اقترب الهواء من التشبع بالرطوبة؛ وهذا يصف الرطوبة ولا يتنبأ بالمطر وحده.`
        : `Air temperature minus dew point is ${number(spread)} ${units.temperature_2m || '°C'} (${number(temperature)} − ${number(dewPoint)}). A smaller temperature–dew-point spread means air is closer to saturation; this describes moisture, but does not by itself predict rain.`,
    });
  } else if (finite(humidity)) {
    explanations.push({
      label: isUrdu ? URDU_LABELS['Moisture in the air'] : locale === 'ar' ? ARABIC_LABELS['Moisture in the air'] : 'Moisture in the air',
      text: isUrdu
        ? `نسبتی نمی ${number(humidity, 0)}${units.relative_humidity_2m || '%'} ہے۔ یہ موجودہ درجۂ حرارت پر saturation کے مقابلے میں نمی کا تناسب ہے، صرف آبی بخارات کی مقدار نہیں۔`
        : locale === 'ar'
        ? `الرطوبة النسبية ${number(humidity, 0)}${units.relative_humidity_2m || '%'}. وهي نسبة الرطوبة إلى حد التشبع عند درجة الحرارة الحالية، وليست مقدار بخار الماء وحده.`
        : `Relative humidity is ${number(humidity, 0)}${units.relative_humidity_2m || '%'}. Humidity is the ratio to saturation at the current temperature, not the amount of water vapour alone.`,
    });
  }

  if (finite(current.cloud_cover)) {
    const solar = finite(current.shortwave_radiation)
      ? ` The provider reports a preceding-hour mean shortwave radiation of ${number(current.shortwave_radiation, 0)} ${units.shortwave_radiation || 'W/m²'}.`
      : '';
    explanations.push({
      label: isUrdu ? URDU_LABELS['Clouds and sunlight'] : locale === 'ar' ? ARABIC_LABELS['Clouds and sunlight'] : 'Clouds and sunlight',
      text: isUrdu
        ? `ماڈل کے مطابق بادلوں کی مقدار ${number(current.cloud_cover, 0)}${units.cloud_cover || '%'} ہے۔${finite(current.shortwave_radiation) ? ` گزشتہ گھنٹے کی اوسط مختصر موجی شمسی تابکاری ${number(current.shortwave_radiation, 0)} ${units.shortwave_radiation || 'W/m²'} تھی۔` : ''} بادل شمسی تابکاری پر اثر ڈالتے ہیں، مگر صرف یہ قدریں ہوا کے درجۂ حرارت کی وجہ ثابت نہیں کرتیں۔`
        : locale === 'ar'
        ? `الغطاء السحابي المقدّر ${number(current.cloud_cover, 0)}${units.cloud_cover || '%'}.${finite(current.shortwave_radiation) ? ` ومتوسط الإشعاع الشمسي قصير الموجة خلال الساعة السابقة ${number(current.shortwave_radiation, 0)} ${units.shortwave_radiation || 'واط/م²'}.` : ''} تؤثر السحب في الإشعاع الشمسي الواصل، لكن هذه الحقول وحدها لا تثبت سبب درجة حرارة الهواء.`
        : `Modelled cloud cover is ${number(current.cloud_cover, 0)}${units.cloud_cover || '%'}.${solar} Clouds affect incoming solar radiation, but these fields alone cannot establish the cause of the air temperature.`,
    });
  }

  if (finite(current.wind_speed_10m)) {
    const direction = finite(current.wind_direction_10m)
      ? ` Direction is ${number(current.wind_direction_10m, 0)}° clockwise from north.`
      : '';
    explanations.push({
      label: isUrdu ? URDU_LABELS.Wind : locale === 'ar' ? ARABIC_LABELS.Wind : 'Wind',
      text: isUrdu
        ? `10 میٹر پر ہوا کی رفتار ${number(current.wind_speed_10m)} ${units.wind_speed_10m || 'km/h'} ہے۔${finite(current.wind_direction_10m) ? ` سمت شمال سے گھڑی کی سمت ${number(current.wind_direction_10m, 0)}° ہے۔` : ''} ہوا حرارت اور نمی منتقل کرتی ہے اور محسوس ہونے والے موسم پر اثر ڈالتی ہے؛ صرف ان قدروں سے ہوا کا ماخذ معلوم نہیں ہوتا۔`
        : locale === 'ar'
        ? `سرعة الرياح على ارتفاع 10 أمتار ${number(current.wind_speed_10m)} ${units.wind_speed_10m || 'كم/س'}.${finite(current.wind_direction_10m) ? ` واتجاهها ${number(current.wind_direction_10m, 0)}° مع عقارب الساعة بدءاً من الشمال.` : ''} تنقل الرياح الحرارة والرطوبة وتؤثر في الإحساس بالراحة؛ لكن هذه القيم وحدها لا تحدد مصدر الهواء.`
        : `Wind at 10 m is ${number(current.wind_speed_10m)} ${units.wind_speed_10m || 'km/h'}.${direction} Wind transports heat and moisture and is one input to perceived comfort; these values alone do not identify where the air came from.`,
    });
  }

  if (finite(current.surface_pressure)) {
    explanations.push({
      label: isUrdu ? URDU_LABELS['Surface pressure'] : locale === 'ar' ? ARABIC_LABELS['Surface pressure'] : 'Surface pressure',
      text: isUrdu
        ? `${number(current.surface_pressure)} ${units.surface_pressure || 'hPa'} فراہم کنندہ کے ماڈل کا تخمینی سطحی دباؤ ہے۔ مقامی بنیادی قدر یا آس پاس کے دباؤ کے نقشے کے بغیر ایک reading سے بلند یا کم دباؤ کا نظام متعین نہیں کیا جا سکتا۔`
        : locale === 'ar'
        ? `ضغط السطح المقدّر من نموذج المصدر ${number(current.surface_pressure)} ${units.surface_pressure || 'هكتوباسكال'}. لا تكفي قراءة واحدة لتحديد نظام ضغط مرتفع أو منخفض من دون خط أساس محلي أو خريطة ضغط للمناطق المحيطة.`
        : `${number(current.surface_pressure)} ${units.surface_pressure || 'hPa'} is the provider’s modelled surface pressure. Without a local baseline or surrounding pressure map, one reading is not enough to diagnose a high- or low-pressure system.`,
    });
  }

  return explanations;
}

export function getNextForecastHours(weather, count = 24) {
  const times = weather?.hourly?.time;
  const currentTime = weather?.current?.time;
  if (!Array.isArray(times) || typeof currentTime !== 'string') return [];
  const start = times.findIndex((time) => typeof time === 'string' && time >= currentTime);
  if (start < 0) return [];

  return times.slice(start, start + count).map((time, offset) => {
    const index = start + offset;
    return {
      time,
      label: time.slice(11, 16),
      temperature: finite(weather.hourly.temperature_2m?.[index]) ? Number(weather.hourly.temperature_2m[index]) : null,
      wind: finite(weather.hourly.wind_speed_10m?.[index]) ? Number(weather.hourly.wind_speed_10m[index]) : null,
      precipitationProbability: finite(weather.hourly.precipitation_probability?.[index])
        ? Number(weather.hourly.precipitation_probability[index])
        : null,
      precipitation: finite(weather.hourly.precipitation?.[index]) ? Number(weather.hourly.precipitation[index]) : null,
    };
  });
}
