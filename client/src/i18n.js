import locales from '../../shared/learning-locales.json';
import baseTranslations from '../../shared/ui-translations.json';
import additionalTranslations from '../../shared/ui-translations-additional.json';
import completionTranslations from '../../shared/ui-translations-completion.json';
import statusTranslations from '../../shared/ui-translations-status.json';
import homeTranslations from '../../shared/home-translations.json';
import notesTranslations from '../../shared/notes-translations.json';
import weatherTranslations from '../../shared/weather-translations.json';
import eventTranslations from '../../shared/event-translations.json';
import accountTranslations from '../../shared/account-translations.json';
import alertTranslations from '../../shared/alert-translations.json';
import sourceTranslations from '../../shared/source-translations.json';
import guideTranslations from '../../shared/guide-translations.json';
import pageTranslations from '../../shared/urdu-page-translations.json';

const translations = Object.fromEntries(
  [...new Set([...Object.keys(baseTranslations), ...Object.keys(additionalTranslations), ...Object.keys(completionTranslations), ...Object.keys(statusTranslations), ...Object.keys(homeTranslations), ...Object.keys(notesTranslations), ...Object.keys(weatherTranslations), ...Object.keys(eventTranslations), ...Object.keys(accountTranslations), ...Object.keys(alertTranslations), ...Object.keys(sourceTranslations), ...Object.keys(guideTranslations), ...Object.keys(pageTranslations)])]
    .map((locale) => [locale, { ...baseTranslations[locale], ...additionalTranslations[locale], ...completionTranslations[locale], ...statusTranslations[locale], ...homeTranslations[locale], ...notesTranslations[locale], ...weatherTranslations[locale], ...eventTranslations[locale], ...accountTranslations[locale], ...alertTranslations[locale], ...sourceTranslations[locale], ...guideTranslations[locale], ...pageTranslations[locale] }]),
);

const initialLocaleCodes = ['en-US', 'ur-PK'];
export const selectableLocales = initialLocaleCodes
  .map((code) => locales.find((item) => item.locale === code))
  .filter(Boolean);

export function translate(locale, source, values = {}) {
  const translated = translations[locale]?.[source] ?? source;
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token,
  );
}

export function getTranslationCoverage(locale, sources) {
  const catalog = translations[locale] || {};
  const keys = [...new Set(sources)];
  const translated = keys.filter((source) => Boolean(catalog[source])).length;
  return { translated, total: keys.length, percent: keys.length ? Math.round((translated / keys.length) * 100) : 100 };
}

export function formatNumber(locale, value, options) {
  return new Intl.NumberFormat(getLocale(locale).locale, options).format(value);
}

export function formatDate(locale, value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getLocale(locale).locale, options).format(date);
}

export function getLocale(locale) {
  return locales.find((item) => item.locale === locale) || locales[0];
}

export function readSavedLocale() {
  try {
    const saved = localStorage.getItem('terra-learning-locale');
    return selectableLocales.some((item) => item.locale === saved) ? saved : 'en-US';
  } catch {
    return 'en-US';
  }
}
