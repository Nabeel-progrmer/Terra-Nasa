import canonicalUi from '../../shared/ui-translations.json';
import notesTranslations from '../../shared/notes-translations.json';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber, getTranslationCoverage, selectableLocales, translate } from './i18n.js';

describe('TERRA localization catalog', () => {
  it('offers only English and Urdu', () => {
    expect(selectableLocales.map(({ locale }) => locale)).toEqual(['en-US', 'ur-PK']);
  });

  it('covers every literal translation call on every page in Urdu', () => {
    const pageFiles = readdirSync('src/pages').filter((file) => file.endsWith('.jsx') && !file.endsWith('.test.jsx'));
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const file of pageFiles) {
      const source = readFileSync(`src/pages/${file}`, 'utf8');
      const calls = [...source.matchAll(/\bt\((['"])((?:\\.|(?!\1)[\s\S])*)\1/g)];
      for (const [, , raw] of calls) {
        const key = raw.replaceAll("\\'", "'").replaceAll('\\"', '"');
        const value = translate('ur-PK', key);
        expect(value, `${file}: ${key}`).not.toBe(key);
        expect(tokens(value), `${file}: ${key}`).toEqual(tokens(key));
      }
    }
  });

  it.each(['ar', 'ja-JP'])('covers every shared UI phrase in %s', (locale) => {
    const coverage = getTranslationCoverage(locale, Object.keys(canonicalUi['ur-PK']));
    expect(coverage).toEqual({ translated: 159, total: 159, percent: 100 });
  });

  it.each(['ur-PK', 'ar', 'ja-JP'])('preserves every interpolation token in %s', (locale) => {
    const sources = Object.keys(canonicalUi['ur-PK']);
    for (const source of sources) {
      const target = translate(locale, source);
      const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
      expect(tokens(target), `${locale}: ${source}`).toEqual(tokens(source));
    }
  });

  it.each(['ur-PK', 'ar', 'ja-JP'])('covers and preserves placeholders for every Overview phrase in %s', (locale) => {
    const homePage = readFileSync('src/pages/HomePage.jsx', 'utf8');
    const sources = [...homePage.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate(locale, source);
      expect(target, `${locale}: missing Overview phrase: ${source}`).not.toBe(source);
      expect(tokens(target), `${locale}: ${source}`).toEqual(tokens(source));
    }
  });

  it.each(['ur-PK', 'ar', 'ja-JP'])('covers all research notes interface phrases in %s', (locale) => {
    const notesPage = readFileSync('src/pages/InvestigationsPage.jsx', 'utf8');
    const sources = [...notesPage.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const starters = [
      'How is near-surface air temperature changing across these places?',
      'How is precipitation changing across these places?',
      'Are humidity trends different across these places?',
      'Are wind-speed trends different across these places?',
    ];
    for (const source of [...sources, ...starters]) {
      expect(notesTranslations[locale]?.[source], `${locale}: missing Notes phrase: ${source}`).toBeTruthy();
      const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
      expect(tokens(notesTranslations[locale][source]), `${locale}: ${source}`).toEqual(tokens(source));
    }
  });

  it('covers the Arabic weather page labels and keeps all placeholders', () => {
    const page = readFileSync('src/pages/WeatherPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic weather page missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
  });

  it('covers all static Arabic earthquake feed phrases and interpolation keys', () => {
    const page = readFileSync('src/pages/EventsPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic earthquake page missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
  });

  it('covers all static Arabic account interface phrases', () => {
    const page = readFileSync('src/pages/AccountPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    for (const source of sources) {
      expect(translate('ar', source), `Arabic account page missing: ${source}`).not.toBe(source);
    }
  });

  it('covers static Arabic alert-safety phrases and placeholder keys', () => {
    const page = readFileSync('src/pages/AlertsPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic alerts page missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
  });

  it('covers Arabic source-registry UI and placeholder keys', () => {
    const page = readFileSync('src/pages/SourcesPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1].replaceAll("\\'", "'"));
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic source registry missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
    expect(translate('ar', 'Integration status does not verify provider uptime.')).not.toBe('Integration status does not verify provider uptime.');
  });

  it('covers Arabic Guide interface phrases and placeholders', () => {
    const page = readFileSync('src/pages/GuidePage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic Guide missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
    for (const name of ['English', 'Urdu', 'Arabic', 'Japanese']) {
      expect(translate('ar', name)).not.toBe(name);
    }
  });

  it('covers current Arabic trend-page headings and scientific-method documentation', () => {
    const page = readFileSync('src/pages/TrendPage.jsx', 'utf8');
    const sources = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    const tokens = (value) => (value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) || []).sort();
    for (const source of sources) {
      const target = translate('ar', source);
      expect(target, `Arabic trend page missing: ${source}`).not.toBe(source);
      expect(tokens(target), source).toEqual(tokens(source));
    }
    for (const label of ['Near-surface air temperature', 'Corrected precipitation rate', 'Relative humidity at 2 m', 'Wind speed at 10 m']) {
      expect(translate('ar', label)).not.toBe(label);
    }
  });

  it('preserves interpolation values and falls back to the English source', () => {
    expect(translate('ja-JP', 'A page without a translation')).toBe('A page without a translation');
  });

  it('formats dates and numbers using the selected locale', () => {
    expect(formatNumber('ja-JP', 1234)).toContain('1,234');
    expect(formatDate('en-US', 'not-a-date')).toBe('');
  });
});
